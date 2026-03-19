import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MiniGameMode,
  MiniGameRoomStatus,
  MiniGameRoundStatus,
  RpsChoice,
  TeamSide,
} from '@prisma/client';
import { TeamRpsVoteService } from './team-rps-vote.service';

describe('TeamRpsVoteService', () => {
  const makeService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      miniGameRoom: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      miniGameParticipant: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      miniGameRound: {
        create: jest.fn(),
      },
      miniGameRoundSubmission: {
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const usersService = {
      findById: jest.fn(),
    };

    const service = new TeamRpsVoteService(prisma as any, usersService as any);
    const emitter = {
      emitRoom: jest.fn(),
      emitUser: jest.fn(),
    };
    service.setEmitter(emitter);

    return { service, prisma, usersService, emitter };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects start when player count is odd', async () => {
    const { service, prisma } = makeService();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'room1',
            mode: MiniGameMode.TEAM_RPS_VOTE,
            hostUserId: 'host1',
            status: MiniGameRoomStatus.WAITING,
            participants: [
              { userId: 'u1', team: TeamSide.A },
              { userId: 'u2', team: TeamSide.A },
              { userId: 'u3', team: TeamSide.B },
            ],
          }),
          update: jest.fn(),
        },
        miniGameRound: {
          create: jest.fn(),
        },
      }),
    );

    await expect(service.startRoom('host1', 'room1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('starts a balanced room and emits round started', async () => {
    const { service, prisma, emitter } = makeService();
    const emitRoomStateSpy = jest
      .spyOn(service as any, 'emitRoomState')
      .mockResolvedValue(undefined);
    const scheduleSpy = jest
      .spyOn(service as any, 'scheduleRoundTimeout')
      .mockImplementation(() => undefined);

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'room1',
            mode: MiniGameMode.TEAM_RPS_VOTE,
            hostUserId: 'host1',
            status: MiniGameRoomStatus.WAITING,
            participants: [
              { userId: 'u1', team: TeamSide.A },
              { userId: 'u2', team: TeamSide.A },
              { userId: 'u3', team: TeamSide.B },
              { userId: 'u4', team: TeamSide.B },
            ],
          }),
          update: jest.fn(),
        },
        miniGameRound: {
          create: jest.fn().mockResolvedValue({
            id: 'round1',
            roundNumber: 1,
            inputStartedAt: new Date('2026-03-18T15:00:00.000Z'),
            inputEndsAt: new Date('2026-03-18T15:00:15.000Z'),
          }),
        },
      }),
    );

    await service.startRoom('host1', 'room1');

    expect(emitRoomStateSpy).toHaveBeenCalledWith('room1');
    expect(emitter.emitRoom).toHaveBeenCalledWith(
      'room1',
      'team_rps:round_started',
      expect.objectContaining({
        roomId: 'room1',
        round: 1,
        inputSeconds: 15,
      }),
    );
    expect(scheduleSpy).toHaveBeenCalledWith(
      'room1',
      'round1',
      new Date('2026-03-18T15:00:15.000Z'),
    );
  });

  it('allows 1v1 start when teams are balanced', async () => {
    const { service, prisma, emitter } = makeService();
    const emitRoomStateSpy = jest
      .spyOn(service as any, 'emitRoomState')
      .mockResolvedValue(undefined);
    const scheduleSpy = jest
      .spyOn(service as any, 'scheduleRoundTimeout')
      .mockImplementation(() => undefined);

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'room-1v1',
            mode: MiniGameMode.TEAM_RPS_VOTE,
            hostUserId: 'host1',
            status: MiniGameRoomStatus.WAITING,
            participants: [
              { userId: 'u1', team: TeamSide.A },
              { userId: 'u2', team: TeamSide.B },
            ],
          }),
          update: jest.fn(),
        },
        miniGameRound: {
          create: jest.fn().mockResolvedValue({
            id: 'round-1v1',
            roundNumber: 1,
            inputStartedAt: new Date('2026-03-18T15:00:00.000Z'),
            inputEndsAt: new Date('2026-03-18T15:00:15.000Z'),
          }),
        },
      }),
    );

    await service.startRoom('host1', 'room-1v1');

    expect(emitRoomStateSpy).toHaveBeenCalledWith('room-1v1');
    expect(emitter.emitRoom).toHaveBeenCalledWith(
      'room-1v1',
      'team_rps:round_started',
      expect.objectContaining({
        roomId: 'room-1v1',
        round: 1,
      }),
    );
    expect(scheduleSpy).toHaveBeenCalledWith(
      'room-1v1',
      'round-1v1',
      new Date('2026-03-18T15:00:15.000Z'),
    );
  });

  it('submits a vote and emits ack plus submitted counts', async () => {
    const { service, prisma, emitter } = makeService();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'room1',
            mode: MiniGameMode.TEAM_RPS_VOTE,
            status: MiniGameRoomStatus.PLAYING,
            participants: [
              { id: 'p1', userId: 'u1', team: TeamSide.A },
              { id: 'p2', userId: 'u2', team: TeamSide.A },
              { id: 'p3', userId: 'u3', team: TeamSide.B },
              { id: 'p4', userId: 'u4', team: TeamSide.B },
            ],
            rounds: [
              {
                id: 'round1',
                roundNumber: 1,
                status: MiniGameRoundStatus.OPEN,
                inputEndsAt: new Date(Date.now() + 10_000),
              },
            ],
          }),
        },
        miniGameRoundSubmission: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'sub1',
            submittedAt: new Date('2026-03-18T15:00:05.000Z'),
          }),
          count: jest.fn().mockResolvedValue(1),
        },
      }),
    );

    prisma.miniGameRoundSubmission.findMany.mockResolvedValue([
      {
        participant: {
          team: TeamSide.A,
        },
      },
    ]);

    await service.submitVote('u1', 'room1', 1, 'rock');

    expect(emitter.emitUser).toHaveBeenCalledWith(
      'u1',
      'team_rps:submit_ack',
      expect.objectContaining({
        roomId: 'room1',
        round: 1,
        accepted: true,
      }),
    );
    expect(emitter.emitRoom).toHaveBeenCalledWith(
      'room1',
      'team_rps:submitted_count',
      expect.objectContaining({
        roomId: 'room1',
        round: 1,
        submittedA: 1,
        submittedB: 0,
        totalA: 2,
        totalB: 2,
      }),
    );
  });

  it('rejects vote submission when room is missing', async () => {
    const { service, prisma } = makeService();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(service.submitVote('u1', 'room-x', 1, 'rock')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('skips emitting when round resolution was already claimed', async () => {
    const { service, prisma, emitter } = makeService();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRound: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          update: jest.fn(),
        },
        miniGameRoom: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        miniGameRoundSubmission: {
          create: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
        transaction: {
          create: jest.fn(),
        },
      }),
    );

    await (service as any).resolveRound('room1', 'round1');

    expect(emitter.emitRoom).not.toHaveBeenCalled();
  });
});
