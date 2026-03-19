import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MajorityDieChoice,
  MajorityDieResolutionReason,
  MiniGameMode,
  MiniGameRoomStatus,
  MiniGameRoundStatus,
  TransactionType,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type RoomEventEmitter = {
  emitRoom: (roomId: string, event: string, payload: unknown) => void;
  emitUser: (userId: string, event: string, payload: unknown) => void;
  emitLobby?: (mode: string, payload: unknown) => void;
};

const DEFAULT_TIMEOUT_SEC = 12;
const MAX_PLAYERS = 20;

@Injectable()
export class MajorityDieService {
  private emitter?: RoomEventEmitter;
  private readonly stageTimers = new Map<string, NodeJS.Timeout>();
  private readonly countdownTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  setEmitter(emitter: RoomEventEmitter) {
    this.emitter = emitter;
  }

  async createRoom(
    hostUserId: string,
    input: {
      name?: string;
      entryStake: number;
      maxPlayers?: number;
      stageTimeoutSec?: number;
    },
  ) {
    this.validateStake(input.entryStake);
    const maxPlayers = input.maxPlayers ?? MAX_PLAYERS;
    const stageTimeoutSec = input.stageTimeoutSec ?? DEFAULT_TIMEOUT_SEC;

    const room = await this.prisma.miniGameRoom.create({
      data: {
        name: input.name?.trim() || null,
        mode: MiniGameMode.MAJORITY_DIE,
        hostUserId,
        entryStake: input.entryStake,
        maxPlayers,
        minPlayers: 2,
        stageTimeoutSec,
        participants: {
          create: {
            userId: hostUserId,
            alive: true,
          },
        },
      },
      include: {
        participants: true,
      },
    });

    await this.emitLobbyUpdate();

    return {
      ok: true,
      room: {
        id: room.id,
        name: room.name,
        mode: 'majority_die',
        stake: room.stake,
        entryStake: room.entryStake,
        hostUserId: room.hostUserId,
        status: room.status.toLowerCase(),
        players: room.participants.length,
        maxPlayers: room.maxPlayers,
        createdAt: Math.floor(room.createdAt.getTime() / 1000),
      },
    };
  }

  async getRoomDetail(roomId: string) {
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
        majorityDieStages: {
          where: { status: MiniGameRoundStatus.OPEN },
          orderBy: { stageNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!room || room.mode !== MiniGameMode.MAJORITY_DIE) {
      throw new NotFoundException('Room not found');
    }

    const stage = room.majorityDieStages[0] ?? null;

    return {
      room: {
        id: room.id,
        name: room.name,
        mode: 'majority_die',
        stake: room.stake,
        entryStake: room.entryStake,
        hostUserId: room.hostUserId,
        status: room.status.toLowerCase(),
        stage: room.currentRound,
        stageEndsAt: stage ? this.toUnix(stage.inputEndsAt) : null,
        players: room.participants.map((participant) => ({
          userId: participant.user.id,
          displayName: participant.user.displayName,
          avatarIndex: participant.user.avatarIndex,
          alive: participant.alive,
        })),
        updatedAt: this.toUnix(room.updatedAt),
      },
    };
  }

  async joinRoom(userId: string, roomId?: string) {
    if (!roomId) throw new BadRequestException('Room not found');

    let joined = false;
    await this.prisma.$transaction(async (tx) => {
      const room = await tx.miniGameRoom.findUnique({
        where: { id: roomId },
        include: { participants: true },
      });

      if (!room || room.mode !== MiniGameMode.MAJORITY_DIE) {
        throw new NotFoundException('Room not found');
      }
      if (room.status !== MiniGameRoomStatus.WAITING) {
        throw new BadRequestException('Room is not joinable');
      }
      if (room.participants.find((participant) => participant.userId === userId)) {
        return;
      }
      if (room.participants.length >= room.maxPlayers) {
        throw new BadRequestException('Room is not joinable');
      }

      await tx.miniGameParticipant.create({
        data: {
          roomId,
          userId,
          alive: true,
        },
      });
      joined = true;
    });

    const [detail, user] = await Promise.all([
      this.getRoomDetail(roomId),
      this.usersService.findById(userId),
    ]);

    if (!user) throw new BadRequestException('Unauthorized');

    if (joined) {
      await this.emitRoomState(roomId);
      await this.emitLobbyUpdate();
    }

    return {
      room: {
        id: detail.room.id,
        status: detail.room.status,
        hostUserId: detail.room.hostUserId,
        mode: detail.room.mode,
        stake: detail.room.stake,
        entryStake: detail.room.entryStake,
      },
      you: {
        userId: user.id,
        displayName: user.displayName,
        avatarIndex: user.avatarIndex,
        alive: true,
      },
    };
  }

  async leaveRoom(userId: string, roomId: string) {
    const room = await this.prisma.miniGameRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });

    if (!room || room.mode !== MiniGameMode.MAJORITY_DIE) {
      throw new NotFoundException('Room not found');
    }

    if (room.status !== MiniGameRoomStatus.WAITING) {
      return;
    }

    const participant = room.participants.find((item) => item.userId === userId);
    if (!participant) {
      return;
    }

    if (room.hostUserId === userId) {
      await this.prisma.miniGameRoom.update({
        where: { id: roomId },
        data: { status: MiniGameRoomStatus.CANCELLED },
      });
      await this.emitRoomState(roomId);
      await this.emitLobbyUpdate();
      return;
    }

    await this.prisma.miniGameParticipant.delete({
      where: { roomId_userId: { roomId, userId } },
    });

    await this.emitRoomState(roomId);
    await this.emitLobbyUpdate();
  }

  async startRoom(userId: string, roomId?: string) {
    if (!roomId) throw new BadRequestException('Room not found');

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.miniGameRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: {
            include: { user: true },
            orderBy: { joinedAt: 'asc' },
          },
        },
      });

      if (!room || room.mode !== MiniGameMode.MAJORITY_DIE) {
        throw new NotFoundException('Room not found');
      }
      if (room.hostUserId !== userId) {
        throw new BadRequestException('Not room host');
      }
      if (room.status !== MiniGameRoomStatus.WAITING) {
        throw new BadRequestException('Room is not joinable');
      }
      if (room.participants.length < 2) {
        throw new BadRequestException('Minimum players is 2');
      }

      for (const participant of room.participants) {
        if (participant.user.coin < room.entryStake) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      for (const participant of room.participants) {
        await tx.user.update({
          where: { id: participant.userId },
          data: { coin: { decrement: room.entryStake } },
        });
        await tx.transaction.create({
          data: {
            type: TransactionType.MAJORITY_DIE_ESCROW,
            fromUserId: participant.userId,
            amount: room.entryStake,
            note: `majority_die escrow ${room.id}`,
          },
        });
      }

      await tx.miniGameRoom.update({
        where: { id: room.id },
        data: {
          status: MiniGameRoomStatus.PLAYING,
          startedAt: now,
          currentRound: 1,
          stake: room.entryStake * room.participants.length,
          participants: {
            updateMany: {
              where: { roomId: room.id },
              data: { alive: true },
            },
          },
        },
      });

      const stage = await tx.majorityDieStage.create({
        data: {
          roomId: room.id,
          stageNumber: 1,
          inputStartedAt: now,
          inputEndsAt: new Date(now.getTime() + room.stageTimeoutSec * 1000),
        },
      });

      return {
        room,
        stage,
      };
    });

    await this.emitRoomState(roomId);
    await this.emitLobbyUpdate();
    this.emitter?.emitRoom(roomId, 'room:started', {
      roomId,
      status: 'playing',
      stage: result.stage.stageNumber,
      stageEndsAt: this.toUnix(result.stage.inputEndsAt),
    });
    this.scheduleStage(
      roomId,
      result.stage.id,
      result.stage.stageNumber,
      result.stage.inputEndsAt,
    );
  }

  async submitChoice(userId: string, roomId?: string, stage?: number, choice?: string) {
    const parsedChoice = this.parseChoice(choice);
    if (!roomId || typeof stage !== 'number') {
      throw new BadRequestException('Submission closed');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.miniGameRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: true,
          majorityDieStages: {
            where: { status: MiniGameRoundStatus.OPEN },
            orderBy: { stageNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (!room || room.mode !== MiniGameMode.MAJORITY_DIE) {
        throw new NotFoundException('Room not found');
      }
      if (room.status !== MiniGameRoomStatus.PLAYING) {
        throw new BadRequestException('Submission closed');
      }

      const participant = room.participants.find((item) => item.userId === userId);
      if (!participant || !participant.alive) {
        throw new BadRequestException('Dead players cannot submit');
      }

      const activeStage = room.majorityDieStages[0];
      if (!activeStage || activeStage.stageNumber !== stage) {
        throw new BadRequestException('Submission closed');
      }

      const existing = await tx.majorityDieStageSubmission.findFirst({
        where: {
          stageId: activeStage.id,
          participantId: participant.id,
        },
      });
      if (existing) {
        throw new BadRequestException('Already submitted');
      }

      const submission = await tx.majorityDieStageSubmission.create({
        data: {
          stageId: activeStage.id,
          participantId: participant.id,
          userId,
          choice: parsedChoice,
        },
      });

      return { stage: activeStage, submission };
    });

    this.emitter?.emitUser(userId, 'game:choice_ack', {
      roomId,
      stage,
      accepted: true,
      submittedAt: this.toUnix(result.submission.submittedAt),
    });
  }

  private async resolveStage(roomId: string, stageId: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const room = await tx.miniGameRoom.findUnique({
          where: { id: roomId },
          include: {
            participants: {
              include: { user: true },
              orderBy: { joinedAt: 'asc' },
            },
            majorityDieStages: {
              where: { id: stageId, status: MiniGameRoundStatus.OPEN },
              include: {
                submissions: {
                  include: { participant: true },
                },
              },
            },
          },
        });

        if (!room || room.mode !== MiniGameMode.MAJORITY_DIE) {
          return null;
        }

        const stage = room.majorityDieStages[0];
        if (!stage || room.status !== MiniGameRoomStatus.PLAYING) {
          return null;
        }

        const aliveParticipants = room.participants.filter((participant) => participant.alive);
        const existing = new Map(
          stage.submissions.map((submission) => [submission.participantId, submission]),
        );

        const autoChoices: Array<{
          userId: string;
          avatarIndex: number;
          choice: MajorityDieChoice;
        }> = [];

        for (const participant of aliveParticipants) {
          if (existing.has(participant.id)) continue;
          const autoChoice = this.getAutoChoice(room.id, stage.stageNumber, participant.userId);
          const submission = await tx.majorityDieStageSubmission.create({
            data: {
              stageId: stage.id,
              participantId: participant.id,
              userId: participant.userId,
              choice: autoChoice,
              autoPicked: true,
            },
          });
          existing.set(participant.id, { ...submission, participant });
          autoChoices.push({
            userId: participant.userId,
            avatarIndex: participant.user.avatarIndex,
            choice: autoChoice,
          });
        }

        const submissions = Array.from(existing.values());
        const leftCount = submissions.filter((item) => item.choice === MajorityDieChoice.LEFT).length;
        const rightCount = submissions.filter((item) => item.choice === MajorityDieChoice.RIGHT).length;

        let minoritySide: MajorityDieChoice | null = null;
        let reason: MajorityDieResolutionReason;
        let eliminatedUserIds: string[] = [];
        let survivorUserIds: string[] = aliveParticipants.map((participant) => participant.userId);

        if (leftCount === rightCount) {
          reason = MajorityDieResolutionReason.TIE_REPLAY;
        } else if (leftCount === 0 || rightCount === 0) {
          reason = MajorityDieResolutionReason.SINGLE_SIDE_REPLAY;
        } else {
          reason = MajorityDieResolutionReason.MINORITY_SURVIVE;
          minoritySide = leftCount < rightCount ? MajorityDieChoice.LEFT : MajorityDieChoice.RIGHT;
          const survivors = submissions
            .filter((item) => item.choice === minoritySide)
            .map((item) => item.participant.userId);
          const eliminated = aliveParticipants
            .filter((participant) => !survivors.includes(participant.userId))
            .map((participant) => participant.userId);

          survivorUserIds = survivors;
          eliminatedUserIds = eliminated;

          if (eliminated.length > 0) {
            await tx.miniGameParticipant.updateMany({
              where: {
                roomId: room.id,
                userId: { in: eliminated },
              },
              data: { alive: false },
            });
          }
        }

        const resolvedAt = new Date();
        await tx.majorityDieStage.update({
          where: { id: stage.id },
          data: {
            status: MiniGameRoundStatus.RESOLVED,
            resolvedAt,
            pickLeftCount: leftCount,
            pickRightCount: rightCount,
            minoritySide,
            resolutionReason: reason,
          },
        });

        const survivors = reason === MajorityDieResolutionReason.MINORITY_SURVIVE
          ? room.participants.filter((participant) => survivorUserIds.includes(participant.userId))
          : aliveParticipants;

        const shouldFinish =
          reason === MajorityDieResolutionReason.MINORITY_SURVIVE &&
          survivors.length <= 2;

        if (shouldFinish) {
          const payouts = this.splitPot(room.stake, survivors.map((participant) => participant.userId));

          for (const payout of payouts) {
            await tx.user.update({
              where: { id: payout.userId },
              data: { coin: { increment: payout.amount } },
            });
            await tx.transaction.create({
              data: {
                type: TransactionType.MAJORITY_DIE_PAYOUT,
                toUserId: payout.userId,
                amount: payout.amount,
                note: `majority_die payout ${room.id}`,
              },
            });
          }

          await tx.miniGameRoom.update({
            where: { id: room.id },
            data: {
              status: MiniGameRoomStatus.FINISHED,
              endedAt: resolvedAt,
            },
          });

          return {
            room,
            stage,
            autoChoices,
            payload: {
              roomId: room.id,
              stage: stage.stageNumber,
              pickCount: {
                left: leftCount,
                right: rightCount,
              },
              minoritySide: minoritySide ? minoritySide.toLowerCase() : null,
              eliminatedUserIds,
              survivorUserIds,
              reason: reason.toLowerCase(),
              resolvedAt: this.toUnix(resolvedAt),
            },
            finished: {
              roomId: room.id,
              mode: 'majority_die',
              winners: survivors.map((participant) => ({
                userId: participant.userId,
                displayName: participant.user.displayName,
                avatarIndex: participant.user.avatarIndex,
              })),
              losers: room.participants
                .filter((participant) => !survivorUserIds.includes(participant.userId))
                .map((participant) => ({
                  userId: participant.userId,
                  displayName: participant.user.displayName,
                  avatarIndex: participant.user.avatarIndex,
                })),
              pot: room.stake,
              payouts: payouts.map((payout) => {
                const participant = room.participants.find((item) => item.userId === payout.userId)!;
                return {
                  userId: payout.userId,
                  displayName: participant.user.displayName,
                  avatarIndex: participant.user.avatarIndex,
                  amount: payout.amount,
                };
              }),
              endedAt: this.toUnix(resolvedAt),
            },
            nextStage: null,
          };
        }

        const nextStageNumber = stage.stageNumber + 1;
        const nextStage = await tx.majorityDieStage.create({
          data: {
            roomId: room.id,
            stageNumber: nextStageNumber,
            inputStartedAt: resolvedAt,
            inputEndsAt: new Date(resolvedAt.getTime() + room.stageTimeoutSec * 1000),
          },
        });

        await tx.miniGameRoom.update({
          where: { id: room.id },
          data: {
            currentRound: nextStageNumber,
          },
        });

        return {
          room,
          stage,
          autoChoices,
          payload: {
            roomId: room.id,
            stage: stage.stageNumber,
            pickCount: {
              left: leftCount,
              right: rightCount,
            },
            minoritySide: minoritySide ? minoritySide.toLowerCase() : null,
            eliminatedUserIds,
            survivorUserIds,
            reason: reason.toLowerCase(),
            resolvedAt: this.toUnix(resolvedAt),
          },
          finished: null,
          nextStage,
        };
      });

      if (!result) return;

      this.clearStage(roomId);
      for (const autoChoice of result.autoChoices) {
        this.emitter?.emitRoom(roomId, 'game:auto_choice_applied', {
          roomId,
          stage: result.stage.stageNumber,
          userId: autoChoice.userId,
          avatarIndex: autoChoice.avatarIndex,
          choice: autoChoice.choice.toLowerCase(),
          auto: true,
        });
      }

      this.emitter?.emitRoom(roomId, 'game:stage_resolved', result.payload);
      await this.emitRoomState(roomId);

      if (result.finished) {
        this.emitter?.emitRoom(roomId, 'game:finished', result.finished);
        await this.emitLobbyUpdate();
        return;
      }

      if (result.nextStage) {
        this.emitter?.emitRoom(roomId, 'room:started', {
          roomId,
          status: 'playing',
          stage: result.nextStage.stageNumber,
          stageEndsAt: this.toUnix(result.nextStage.inputEndsAt),
        });
        this.scheduleStage(
          roomId,
          result.nextStage.id,
          result.nextStage.stageNumber,
          result.nextStage.inputEndsAt,
        );
      }
    } catch {
      await this.refundRoom(roomId, 'UNEXPECTED_STATE');
    }
  }

  private async refundRoom(roomId: string, reason: string) {
    const room = await this.prisma.miniGameRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!room || room.mode !== MiniGameMode.MAJORITY_DIE) {
      return;
    }

    if (room.stake > 0) {
      for (const participant of room.participants) {
        await this.prisma.user.update({
          where: { id: participant.userId },
          data: { coin: { increment: room.entryStake } },
        });
        await this.prisma.transaction.create({
          data: {
            type: TransactionType.MAJORITY_DIE_REFUND,
            toUserId: participant.userId,
            amount: room.entryStake,
            note: `majority_die refund ${room.id}`,
          },
        });
      }
    }

    await this.prisma.miniGameRoom.update({
      where: { id: room.id },
      data: {
        status: MiniGameRoomStatus.CANCELLED,
        endedAt: new Date(),
      },
    });

    this.emitter?.emitRoom(room.id, 'socket:error', {
      code: 'INTERNAL_ERROR',
      message: reason,
    });
    await this.emitRoomState(room.id);
    await this.emitLobbyUpdate();
  }

  private scheduleStage(
    roomId: string,
    stageId: string,
    stageNumber: number,
    endsAt: Date,
  ) {
    this.clearStage(roomId);
    const resolveTimer = setTimeout(() => {
      void this.resolveStage(roomId, stageId);
    }, Math.max(0, endsAt.getTime() - Date.now()));
    this.stageTimers.set(roomId, resolveTimer);

    const tick = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 1000));
      this.emitter?.emitRoom(roomId, 'game:stage_countdown', {
        roomId,
        stage: stageNumber,
        secondsLeft,
      });
      if (secondsLeft <= 0) {
        clearInterval(tick);
      }
    }, 1000) as unknown as NodeJS.Timeout;

    this.countdownTimers.set(roomId, tick);
  }

  private clearStage(roomId: string) {
    const timeout = this.stageTimers.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      this.stageTimers.delete(roomId);
    }

    const countdown = this.countdownTimers.get(roomId);
    if (countdown) {
      clearInterval(countdown);
      this.countdownTimers.delete(roomId);
    }
  }

  private async emitRoomState(roomId: string) {
    const detail = await this.getRoomDetail(roomId).catch(() => null);
    if (detail) {
      this.emitter?.emitRoom(roomId, 'room:state', {
        roomId: detail.room.id,
        status: detail.room.status,
        stage: detail.room.stage,
        players: detail.room.players,
        updatedAt: detail.room.updatedAt,
      });
    }
  }

  private async emitLobbyUpdate() {
    if (!this.emitter?.emitLobby) return;

    const rooms = await this.prisma.miniGameRoom.findMany({
      where: {
        mode: MiniGameMode.MAJORITY_DIE,
        status: MiniGameRoomStatus.WAITING,
      },
      include: {
        participants: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    this.emitter.emitLobby('majority_die', {
      mode: 'majority_die',
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        status: room.status.toLowerCase(),
        players: room.participants.length,
        stake: room.stake,
        entryStake: room.entryStake,
        updatedAt: this.toUnix(room.updatedAt),
      })),
    });
  }

  private validateStake(entryStake: number) {
    if (!Number.isInteger(entryStake) || entryStake < 5 || entryStake % 5 !== 0) {
      throw new BadRequestException('Entry stake minimum is 5 and must be step of 5');
    }
  }

  private parseChoice(choice?: string) {
    const normalized = `${choice ?? ''}`.trim().toLowerCase();
    if (normalized === 'left') return MajorityDieChoice.LEFT;
    if (normalized === 'right') return MajorityDieChoice.RIGHT;
    throw new BadRequestException('Submission closed');
  }

  private getAutoChoice(roomId: string, stage: number, userId: string) {
    const options = [MajorityDieChoice.LEFT, MajorityDieChoice.RIGHT];
    const hash = createHash('sha256')
      .update(`${roomId}:${stage}:${userId}:majority-die:auto`)
      .digest('hex');
    return options[parseInt(hash.slice(0, 8), 16) % options.length];
  }

  private splitPot(total: number, userIds: string[]) {
    const base = Math.floor(total / userIds.length);
    let remainder = total % userIds.length;

    return userIds.map((userId) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return {
        userId,
        amount: base + extra,
      };
    });
  }

  private toUnix(date: Date | null) {
    if (!date) return null;
    return Math.floor(date.getTime() / 1000);
  }
}
