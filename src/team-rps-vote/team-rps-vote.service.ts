import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MiniGameMode,
  MiniGameRoomStatus,
  MiniGameRoundStatus,
  Prisma,
  RpsChoice,
  TeamSide,
  TransactionType,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type RoomEventEmitter = {
  emitRoom: (roomId: string, event: string, payload: unknown) => void;
  emitUser: (userId: string, event: string, payload: unknown) => void;
};

type RoomState = Awaited<ReturnType<TeamRpsVoteService['getRoomState']>>;

const INPUT_SECONDS = 15;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const WIN_TARGET = 2;
const VALID_CHOICES = ['rock', 'paper', 'scissors'] as const;

@Injectable()
export class TeamRpsVoteService {
  private emitter?: RoomEventEmitter;
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  setEmitter(emitter: RoomEventEmitter) {
    this.emitter = emitter;
  }

  async getSocketUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarIndex: user.avatarIndex,
    };
  }

  async createRoom(hostUserId: string, entryStake: number, name?: string) {
    this.validateStake(entryStake);

    const room = await this.prisma.$transaction(async (tx) => {
      const host = await tx.user.findUnique({ where: { id: hostUserId } });
      if (!host || host.coin < entryStake) {
        throw new BadRequestException('Insufficient balance to create room');
      }

      await tx.user.update({
        where: { id: hostUserId },
        data: { coin: { decrement: entryStake } },
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.TEAM_RPS_VOTE_ESCROW,
          fromUserId: hostUserId,
          amount: entryStake,
          note: 'team_rps_vote room host escrow',
        },
      });

      const createdRoom = await tx.miniGameRoom.create({
        data: {
          name: name?.trim() || null,
          mode: MiniGameMode.TEAM_RPS_VOTE,
          hostUserId,
          entryStake,
          stake: entryStake,
          minPlayers: MIN_PLAYERS,
          maxPlayers: MAX_PLAYERS,
        },
      });

      await tx.miniGameParticipant.create({
        data: {
          roomId: createdRoom.id,
          userId: hostUserId,
        },
      });

      return createdRoom;
    });

    return this.getRoomState(room.id);
  }

  async listRooms() {
    const rooms = await this.prisma.miniGameRoom.findMany({
      where: {
        mode: MiniGameMode.TEAM_RPS_VOTE,
        status: MiniGameRoomStatus.WAITING,
      },
      include: {
        participants: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rooms.map((room) => {
      const counts = this.getTeamCounts(room.participants);
      return {
        id: room.id,
        name: room.name,
        mode: 'team_rps_vote',
        status: room.status.toLowerCase(),
        entryStake: room.entryStake,
        stake: room.stake,
        players: room.participants.length,
        teamCounts: counts,
        hostUserId: room.hostUserId,
        createdAt: this.toUnix(room.createdAt),
      };
    });
  }

  async getRoomState(roomId: string) {
    const room = await this.prisma.miniGameRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarIndex: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        rounds: {
          where: { status: MiniGameRoundStatus.OPEN },
          orderBy: { roundNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
      throw new NotFoundException('Room not found');
    }

    const counts = this.getTeamCounts(room.participants);
    const openRound = room.rounds[0] ?? null;

    return {
      roomId: room.id,
      name: room.name,
      mode: 'team_rps_vote',
      status: room.status.toLowerCase(),
      matchFormat: 'BO3',
      round: room.currentRound,
      score: {
        A: room.scoreA,
        B: room.scoreB,
      },
      entryStake: room.entryStake,
      stake: room.stake,
      teams: {
        A: this.serializeTeam(room.participants, TeamSide.A),
        B: this.serializeTeam(room.participants, TeamSide.B),
      },
      teamCounts: counts,
      players: room.participants.length,
      hostUserId: room.hostUserId,
      inputEndsAt: openRound ? this.toUnix(openRound.inputEndsAt) : null,
      updatedAt: this.toUnix(room.updatedAt),
    };
  }

  async joinRoom(userId: string, roomId?: string) {
    if (!roomId) {
      throw new BadRequestException('Room not found');
    }

    let newlyJoined = false;

    await this.prisma.$transaction(async (tx) => {
      const room = await tx.miniGameRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: true,
        },
      });

      if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
        throw new NotFoundException('Room not found');
      }

      const existing = room.participants.find((item) => item.userId === userId);
      if (existing) {
        return;
      }

      if (room.status !== MiniGameRoomStatus.WAITING) {
        throw new BadRequestException('Room is not joinable');
      }

      if (room.participants.length >= room.maxPlayers) {
        throw new BadRequestException('Room is not joinable');
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.coin < room.entryStake) {
        throw new BadRequestException('Insufficient balance to join room');
      }

      await tx.user.update({
        where: { id: userId },
        data: { coin: { decrement: room.entryStake } },
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.TEAM_RPS_VOTE_ESCROW,
          fromUserId: userId,
          amount: room.entryStake,
          note: `team_rps_vote join escrow ${room.id}`,
        },
      });

      await tx.miniGameParticipant.create({
        data: {
          roomId: room.id,
          userId,
        },
      });

      await tx.miniGameRoom.update({
        where: { id: room.id },
        data: {
          stake: { increment: room.entryStake },
        },
      });

      newlyJoined = true;
    });

    const [room, user] = await Promise.all([
      this.getRoomState(roomId),
      this.getSocketUser(userId),
    ]);

    if (newlyJoined) {
      await this.emitRoomState(roomId);
    }

    return {
      room: {
        id: room.roomId,
        mode: room.mode,
        status: room.status,
        entryStake: room.entryStake,
        stake: room.stake,
        players: room.players,
        teamCounts: room.teamCounts,
        hostUserId: room.hostUserId,
      },
      you: {
        userId: user.id,
        displayName: user.displayName,
        avatarIndex: user.avatarIndex,
      },
    };
  }

  async leaveRoom(userId: string, roomId: string) {
    if (!roomId) {
      throw new BadRequestException('Room not found');
    }

    const room = await this.prisma.miniGameRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: true,
      },
    });

    if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
      throw new NotFoundException('Room not found');
    }

    const participant = room.participants.find((item) => item.userId === userId);
    if (!participant) {
      return;
    }

    if (room.status !== MiniGameRoomStatus.WAITING) {
      return;
    }

    if (room.hostUserId === userId) {
      await this.refundRoom(roomId, 'HOST_LEFT', MiniGameRoomStatus.CANCELLED);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { coin: { increment: room.entryStake } },
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.TEAM_RPS_VOTE_REFUND,
          toUserId: userId,
          amount: room.entryStake,
          note: `team_rps_vote room leave refund ${room.id}`,
        },
      });

      await tx.miniGameParticipant.delete({
        where: { roomId_userId: { roomId, userId } },
      });

      await tx.miniGameRoom.update({
        where: { id: roomId },
        data: { stake: { decrement: room.entryStake } },
      });
    });

    await this.emitRoomState(roomId);
  }

  async chooseTeam(userId: string, roomId?: string, team?: string) {
    const normalizedTeam = this.parseTeam(team);
    const room = await this.prisma.miniGameRoom.findUnique({
      where: { id: roomId ?? '' },
      include: { participants: true },
    });

    if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
      throw new NotFoundException('Room not found');
    }
    if (room.status !== MiniGameRoomStatus.WAITING) {
      throw new BadRequestException('Team selection closed');
    }

    const participant = room.participants.find((item) => item.userId === userId);
    if (!participant) {
      throw new BadRequestException('Room is not joinable');
    }

    await this.prisma.miniGameParticipant.update({
      where: { roomId_userId: { roomId: room.id, userId } },
      data: { team: normalizedTeam },
    });

    const state = await this.getRoomState(room.id);
    this.emitter?.emitRoom(room.id, 'team:updated', {
      roomId: room.id,
      userId,
      team: normalizedTeam,
      teamCounts: state.teamCounts,
      updatedAt: state.updatedAt,
    });
    await this.emitRoomState(room.id);
  }

  async startRoom(userId: string, roomId?: string) {
    if (!roomId) {
      throw new BadRequestException('Room not found');
    }

    const now = new Date();
    const inputEndsAt = new Date(now.getTime() + INPUT_SECONDS * 1000);

    const round = await this.prisma.$transaction(async (tx) => {
      const room = await tx.miniGameRoom.findUnique({
        where: { id: roomId },
        include: { participants: true },
      });

      if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
        throw new NotFoundException('Room not found');
      }
      if (room.hostUserId !== userId) {
        throw new BadRequestException('Not room host');
      }
      if (room.status !== MiniGameRoomStatus.WAITING) {
        throw new BadRequestException('Room is not joinable');
      }

      this.validateStart(room.participants);

      await tx.miniGameRoom.update({
        where: { id: room.id },
        data: {
          status: MiniGameRoomStatus.PLAYING,
          startedAt: now,
          currentRound: 1,
        },
      });

      return tx.miniGameRound.create({
        data: {
          roomId: room.id,
          roundNumber: 1,
          inputStartedAt: now,
          inputEndsAt,
        },
      });
    });

    await this.emitRoomState(roomId);
    this.emitter?.emitRoom(roomId, 'team_rps:round_started', {
      roomId,
      round: round.roundNumber,
      inputStartedAt: this.toUnix(round.inputStartedAt),
      inputEndsAt: this.toUnix(round.inputEndsAt),
      inputSeconds: INPUT_SECONDS,
    });
    this.scheduleRoundTimeout(roomId, round.id, round.inputEndsAt);
  }

  async submitVote(
    userId: string,
    roomId?: string,
    roundNumber?: number,
    choice?: string,
  ) {
    const normalizedChoice = this.parseChoice(choice);
    if (!roomId || typeof roundNumber !== 'number') {
      throw new BadRequestException('Submission closed');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.miniGameRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: true,
          rounds: {
            where: { status: MiniGameRoundStatus.OPEN },
            take: 1,
            orderBy: { roundNumber: 'desc' },
          },
        },
      });

      if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
        throw new NotFoundException('Room not found');
      }
      if (room.status !== MiniGameRoomStatus.PLAYING) {
        throw new BadRequestException('Submission closed');
      }

      const participant = room.participants.find((item) => item.userId === userId);
      if (!participant || !participant.team) {
        throw new BadRequestException('Room is not joinable');
      }

      const round = room.rounds[0];
      if (!round || round.roundNumber !== roundNumber) {
        throw new BadRequestException('Submission closed');
      }
      if (round.inputEndsAt.getTime() <= Date.now()) {
        throw new BadRequestException('Submission closed');
      }

      const existing = await tx.miniGameRoundSubmission.findFirst({
        where: {
          roundId: round.id,
          participantId: participant.id,
        },
      });
      if (existing) {
        throw new BadRequestException('Already submitted');
      }

      const submission = await tx.miniGameRoundSubmission.create({
        data: {
          roundId: round.id,
          participantId: participant.id,
          userId,
          choice: normalizedChoice,
        },
      });

      const submittedCount = await tx.miniGameRoundSubmission.count({
        where: { roundId: round.id },
      });

      return { room, round, participant, submission, submittedCount };
    });

    this.emitter?.emitUser(userId, 'team_rps:submit_ack', {
      roomId,
      round: roundNumber,
      accepted: true,
      submittedAt: this.toUnix(result.submission.submittedAt),
    });

    const totals = this.getTeamCounts(result.room.participants);
    const submissions = await this.prisma.miniGameRoundSubmission.findMany({
      where: { roundId: result.round.id },
      include: {
        participant: true,
      },
    });
    const submitted = this.getSubmittedCounts(submissions);

    this.emitter?.emitRoom(roomId, 'team_rps:submitted_count', {
      roomId,
      round: roundNumber,
      submittedA: submitted.A,
      submittedB: submitted.B,
      totalA: totals.A,
      totalB: totals.B,
      secondsLeft: Math.max(
        0,
        Math.floor(result.round.inputEndsAt.getTime() / 1000) -
          Math.floor(Date.now() / 1000),
      ),
    });
  }

  mapErrorCode(message: string) {
    const codeMap: Record<string, string> = {
      Unauthorized: 'UNAUTHORIZED',
      'Room not found': 'ROOM_NOT_FOUND',
      'Room is not joinable': 'ROOM_NOT_JOINABLE',
      'Team selection closed': 'TEAM_SELECTION_CLOSED',
      'Teams must be balanced before start': 'TEAM_NOT_EQUAL',
      'Player count must be even': 'ODD_PLAYER_NOT_ALLOWED',
      'Player count must be between 2 and 10': 'INVALID_TEAM_BALANCE',
      'Every player must choose a team before start': 'INVALID_TEAM_BALANCE',
      'Already submitted': 'ALREADY_SUBMITTED',
      'Submission closed': 'SUBMISSION_CLOSED',
      'Not room host': 'NOT_ROOM_HOST',
      'Insufficient balance to create room': 'ROOM_NOT_JOINABLE',
      'Insufficient balance to join room': 'ROOM_NOT_JOINABLE',
    };

    return codeMap[message] ?? 'INTERNAL_ERROR';
  }

  private async resolveRound(roomId: string, roundId: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const claimResolvedAt = new Date();
        const claimed = await tx.miniGameRound.updateMany({
          where: {
            id: roundId,
            status: MiniGameRoundStatus.OPEN,
          },
          data: {
            status: MiniGameRoundStatus.RESOLVED,
            resolvedAt: claimResolvedAt,
          },
        });

        if (claimed.count === 0) {
          return null;
        }

        const room = await tx.miniGameRoom.findUnique({
          where: { id: roomId },
          include: {
            participants: {
              include: { user: true },
              orderBy: { joinedAt: 'asc' },
            },
            rounds: {
              where: { id: roundId },
              include: {
                submissions: {
                  include: {
                    participant: true,
                  },
                },
              },
            },
          },
        });

        if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
          return null;
        }
        if (room.status !== MiniGameRoomStatus.PLAYING) {
          return null;
        }

        const round = room.rounds[0];
        if (!round) {
          return null;
        }

        const existingByParticipant = new Map(
          round.submissions.map((item) => [item.participantId, item]),
        );

        const autoPicks: Array<{
          userId: string;
          team: TeamSide;
          choice: RpsChoice;
        }> = [];

        for (const participant of room.participants) {
          if (!participant.team || existingByParticipant.has(participant.id)) {
            continue;
          }

          const choice = this.getDeterministicAutoPick(
            room.id,
            round.roundNumber,
            participant.userId,
          );
          const created = await tx.miniGameRoundSubmission.create({
            data: {
              roundId: round.id,
              participantId: participant.id,
              userId: participant.userId,
              choice,
              autoPicked: true,
            },
          });
          existingByParticipant.set(participant.id, {
            ...created,
            participant,
          });
          autoPicks.push({
            userId: participant.userId,
            team: participant.team,
            choice,
          });
        }

        const submissions = Array.from(existingByParticipant.values());
        const tallyA = this.tallyForTeam(submissions, TeamSide.A);
        const tallyB = this.tallyForTeam(submissions, TeamSide.B);
        const teamA = this.resolveTeamChoice(room.id, round.roundNumber, TeamSide.A, tallyA);
        const teamB = this.resolveTeamChoice(room.id, round.roundNumber, TeamSide.B, tallyB);
        const outcome = this.resolveRps(teamA.choice, teamB.choice);

        const nextScoreA = room.scoreA + (outcome === 'A' ? 1 : 0);
        const nextScoreB = room.scoreB + (outcome === 'B' ? 1 : 0);
        const resolvedAt = new Date();

        await tx.miniGameRound.update({
          where: { id: round.id },
          data: {
            resolvedAt,
            teamChoiceA: teamA.choice,
            teamChoiceB: teamB.choice,
            teamTieBreakA: teamA.tieBreak,
            teamTieBreakB: teamB.tieBreak,
            countRockA: tallyA.rock,
            countPaperA: tallyA.paper,
            countScissorsA: tallyA.scissors,
            countRockB: tallyB.rock,
            countPaperB: tallyB.paper,
            countScissorsB: tallyB.scissors,
            roundWinner: outcome === 'draw' ? null : outcome,
          },
        });

        const resolvedPayload = {
          roomId: room.id,
          round: round.roundNumber,
          teamChoice: {
            A: this.choiceToClient(teamA.choice),
            B: this.choiceToClient(teamB.choice),
          },
          teamVoteCount: {
            A: tallyA,
            B: tallyB,
          },
          teamVoteTieBreak: {
            A: teamA.tieBreak,
            B: teamB.tieBreak,
          },
          roundWinner: outcome === 'draw' ? null : outcome,
          score: {
            A: nextScoreA,
            B: nextScoreB,
          },
          resolvedAt: this.toUnix(resolvedAt),
        };

        const finished = nextScoreA >= WIN_TARGET || nextScoreB >= WIN_TARGET;
        if (finished) {
          const winnerTeam = nextScoreA > nextScoreB ? TeamSide.A : TeamSide.B;
          const winners = room.participants.filter((item) => item.team === winnerTeam);
          const payoutAmount = room.entryStake * 2;

          for (const winner of winners) {
            await tx.user.update({
              where: { id: winner.userId },
              data: { coin: { increment: payoutAmount } },
            });

            await tx.transaction.create({
              data: {
                type: TransactionType.TEAM_RPS_VOTE_PAYOUT,
                toUserId: winner.userId,
                amount: payoutAmount,
                note: `team_rps_vote payout ${room.id}`,
              },
            });
          }

          await tx.miniGameRoom.update({
            where: { id: room.id },
            data: {
              scoreA: nextScoreA,
              scoreB: nextScoreB,
              status: MiniGameRoomStatus.FINISHED,
              endedAt: resolvedAt,
            },
          });

          return {
            autoPicks,
            resolvedPayload,
            finishPayload: {
              roomId: room.id,
              winnerTeam,
              score: {
                A: nextScoreA,
                B: nextScoreB,
              },
              entryStake: room.entryStake,
              stake: room.stake,
              winners: winners.map((winner) => ({
                userId: winner.userId,
                displayName: winner.user.displayName,
                avatarIndex: winner.user.avatarIndex,
              })),
              payouts: winners.map((winner) => ({
                userId: winner.userId,
                amount: payoutAmount,
              })),
              endedAt: this.toUnix(resolvedAt),
            },
            nextRound: null,
          };
        }

        const nextRoundNumber = round.roundNumber + 1;
        const nextInputEndsAt = new Date(Date.now() + INPUT_SECONDS * 1000);
        const nextRound = await tx.miniGameRound.create({
          data: {
            roomId: room.id,
            roundNumber: nextRoundNumber,
            inputStartedAt: resolvedAt,
            inputEndsAt: nextInputEndsAt,
          },
        });

        await tx.miniGameRoom.update({
          where: { id: room.id },
          data: {
            scoreA: nextScoreA,
            scoreB: nextScoreB,
            currentRound: nextRoundNumber,
          },
        });

        return {
          autoPicks,
          resolvedPayload,
          finishPayload: null,
          nextRound: nextRound,
        };
      });

      if (!result) {
        return;
      }

      for (const autoPick of result.autoPicks) {
        this.emitter?.emitRoom(roomId, 'team_rps:auto_pick_applied', {
          roomId,
          round: result.resolvedPayload.round,
          userId: autoPick.userId,
          team: autoPick.team,
          choice: this.choiceToClient(autoPick.choice),
          auto: true,
        });
      }

      this.emitter?.emitRoom(roomId, 'team_rps:round_resolved', result.resolvedPayload);
      await this.emitRoomState(roomId);

      if (result.finishPayload) {
        this.clearTimer(roomId);
        this.emitter?.emitRoom(roomId, 'team_rps:finished', {
          ...result.finishPayload,
          winnerTeam: result.finishPayload.winnerTeam,
        });
        return;
      }

      if (result.nextRound) {
        this.emitter?.emitRoom(roomId, 'team_rps:round_started', {
          roomId,
          round: result.nextRound.roundNumber,
          inputStartedAt: this.toUnix(result.nextRound.inputStartedAt),
          inputEndsAt: this.toUnix(result.nextRound.inputEndsAt),
          inputSeconds: INPUT_SECONDS,
        });
        this.scheduleRoundTimeout(roomId, result.nextRound.id, result.nextRound.inputEndsAt);
      }
    } catch {
      await this.refundRoom(roomId, 'UNEXPECTED_STATE', MiniGameRoomStatus.FINISHED);
    }
  }

  private async refundRoom(
    roomId: string,
    reason: string,
    status: MiniGameRoomStatus,
  ) {
    this.clearTimer(roomId);

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.miniGameRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!room || room.mode !== MiniGameMode.TEAM_RPS_VOTE) {
        return null;
      }

      if (
        room.status === MiniGameRoomStatus.CANCELLED ||
        (room.status === MiniGameRoomStatus.FINISHED && room.endedAt)
      ) {
        return null;
      }

      const endedAt = new Date();
      for (const participant of room.participants) {
        await tx.user.update({
          where: { id: participant.userId },
          data: { coin: { increment: room.entryStake } },
        });

        await tx.transaction.create({
          data: {
            type: TransactionType.TEAM_RPS_VOTE_REFUND,
            toUserId: participant.userId,
            amount: room.entryStake,
            note: `team_rps_vote refund ${room.id}`,
          },
        });
      }

      await tx.miniGameRoom.update({
        where: { id: room.id },
        data: {
          status,
          endedAt,
        },
      });

      return {
        roomId: room.id,
        draw: true,
        reason,
        refunds: room.participants.map((participant) => ({
          userId: participant.userId,
          amount: room.entryStake,
        })),
        endedAt: this.toUnix(endedAt),
      };
    });

    if (result) {
      this.emitter?.emitRoom(roomId, 'team_rps:finished_draw', result);
      await this.emitRoomState(roomId);
    }
  }

  private scheduleRoundTimeout(roomId: string, roundId: string, inputEndsAt: Date) {
    this.clearTimer(roomId);
    const delay = Math.max(0, inputEndsAt.getTime() - Date.now());
    const timer = setTimeout(() => {
      void this.resolveRound(roomId, roundId);
    }, delay);
    this.timers.set(roomId, timer);
  }

  private clearTimer(roomId: string) {
    const existing = this.timers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(roomId);
    }
  }

  private async emitRoomState(roomId: string) {
    const state = await this.getRoomState(roomId).catch(() => null);
    if (state) {
      this.emitter?.emitRoom(roomId, 'room:state', state);
    }
  }

  private validateStake(entryStake: number) {
    if (!Number.isInteger(entryStake) || entryStake < 5 || entryStake % 5 !== 0) {
      throw new BadRequestException(
        'Entry stake minimum is 5 and must be step of 5',
      );
    }
  }

  private validateStart(
    participants: Array<{
      team: TeamSide | null;
    }>,
  ) {
    if (
      participants.length < MIN_PLAYERS ||
      participants.length > MAX_PLAYERS
    ) {
      throw new BadRequestException('Player count must be between 2 and 10');
    }
    if (participants.length % 2 !== 0) {
      throw new BadRequestException('Player count must be even');
    }

    const teamCounts = this.getTeamCounts(participants);
    if (teamCounts.A + teamCounts.B !== participants.length) {
      throw new BadRequestException('Every player must choose a team before start');
    }
    if (teamCounts.A !== teamCounts.B) {
      throw new BadRequestException('Teams must be balanced before start');
    }
  }

  private parseTeam(team?: string) {
    const normalized = `${team ?? ''}`.trim().toUpperCase();
    if (normalized !== 'A' && normalized !== 'B') {
      throw new BadRequestException('Teams must be balanced before start');
    }
    return normalized as TeamSide;
  }

  private parseChoice(choice?: string) {
    const normalized = `${choice ?? ''}`.trim().toLowerCase();
    if (!VALID_CHOICES.includes(normalized as (typeof VALID_CHOICES)[number])) {
      throw new BadRequestException('Submission closed');
    }

    if (normalized === 'rock') return RpsChoice.ROCK;
    if (normalized === 'paper') return RpsChoice.PAPER;
    return RpsChoice.SCISSORS;
  }

  private getTeamCounts(
    participants: Array<{
      team?: TeamSide | null;
    }>,
  ) {
    return participants.reduce(
      (acc, participant) => {
        if (participant.team === TeamSide.A) acc.A += 1;
        if (participant.team === TeamSide.B) acc.B += 1;
        return acc;
      },
      { A: 0, B: 0 },
    );
  }

  private serializeTeam(
    participants: Array<{
      team: TeamSide | null;
      user: {
        id: string;
        displayName: string;
        avatarIndex: number;
      };
    }>,
    team: TeamSide,
  ) {
    return participants
      .filter((participant) => participant.team === team)
      .map((participant) => ({
        userId: participant.user.id,
        displayName: participant.user.displayName,
        avatarIndex: participant.user.avatarIndex,
      }));
  }

  private getSubmittedCounts(
    submissions: Array<{
      participant: {
        team: TeamSide | null;
      };
    }>,
  ) {
    return submissions.reduce(
      (acc, submission) => {
        if (submission.participant.team === TeamSide.A) acc.A += 1;
        if (submission.participant.team === TeamSide.B) acc.B += 1;
        return acc;
      },
      { A: 0, B: 0 },
    );
  }

  private tallyForTeam(
    submissions: Array<{
      choice: RpsChoice;
      participant: {
        team: TeamSide | null;
      };
    }>,
    team: TeamSide,
  ) {
    const tally = { rock: 0, paper: 0, scissors: 0 };
    for (const submission of submissions) {
      if (submission.participant.team !== team) continue;
      if (submission.choice === RpsChoice.ROCK) tally.rock += 1;
      if (submission.choice === RpsChoice.PAPER) tally.paper += 1;
      if (submission.choice === RpsChoice.SCISSORS) tally.scissors += 1;
    }
    return tally;
  }

  private resolveTeamChoice(
    roomId: string,
    roundNumber: number,
    team: TeamSide,
    tally: { rock: number; paper: number; scissors: number },
  ) {
    const entries: Array<{ key: 'rock' | 'paper' | 'scissors'; count: number }> = [
      { key: 'rock', count: tally.rock },
      { key: 'paper', count: tally.paper },
      { key: 'scissors', count: tally.scissors },
    ];
    const max = Math.max(...entries.map((entry) => entry.count));
    const finalists = entries.filter((entry) => entry.count === max);
    const tieBreak = finalists.length > 1;
    const chosen = tieBreak
      ? finalists[
          this.hashIndex(
            `${roomId}:${roundNumber}:${team}:team-choice`,
            finalists.length,
          )
        ]
      : finalists[0];

    return {
      choice: this.clientChoiceToEnum(chosen.key),
      tieBreak,
    };
  }

  private resolveRps(choiceA: RpsChoice, choiceB: RpsChoice) {
    if (choiceA === choiceB) return 'draw' as const;
    if (
      (choiceA === RpsChoice.ROCK && choiceB === RpsChoice.SCISSORS) ||
      (choiceA === RpsChoice.PAPER && choiceB === RpsChoice.ROCK) ||
      (choiceA === RpsChoice.SCISSORS && choiceB === RpsChoice.PAPER)
    ) {
      return TeamSide.A;
    }
    return TeamSide.B;
  }

  private getDeterministicAutoPick(
    roomId: string,
    roundNumber: number,
    userId: string,
  ) {
    const options = [RpsChoice.ROCK, RpsChoice.PAPER, RpsChoice.SCISSORS];
    return options[
      this.hashIndex(`${roomId}:${roundNumber}:${userId}:auto-pick`, options.length)
    ];
  }

  private hashIndex(seed: string, modulo: number) {
    const hash = createHash('sha256').update(seed).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % modulo;
  }

  private choiceToClient(choice: RpsChoice) {
    return choice.toLowerCase();
  }

  private clientChoiceToEnum(choice: 'rock' | 'paper' | 'scissors') {
    if (choice === 'rock') return RpsChoice.ROCK;
    if (choice === 'paper') return RpsChoice.PAPER;
    return RpsChoice.SCISSORS;
  }

  private toUnix(date: Date | null) {
    if (!date) return null;
    return Math.floor(date.getTime() / 1000);
  }
}
