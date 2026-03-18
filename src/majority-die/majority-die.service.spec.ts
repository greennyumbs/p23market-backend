import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MiniGameMode,
  MiniGameRoomStatus,
  MiniGameRoundStatus,
  MajorityDieChoice,
} from '@prisma/client';
import { MajorityDieService } from './majority-die.service';

describe('MajorityDieService', () => {
  const makeService = () => {
    const prisma = {
      miniGameRoom: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      miniGameParticipant: {
        create: jest.fn(),
        delete: jest.fn(),
      },
      majorityDieStage: {
        create: jest.fn(),
      },
      majorityDieStageSubmission: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const usersService = {
      findById: jest.fn(),
    };

    const service = new MajorityDieService(prisma as any, usersService as any);
    const emitter = {
      emitRoom: jest.fn(),
      emitUser: jest.fn(),
      emitLobby: jest.fn(),
    };
    service.setEmitter(emitter);

    return { service, prisma, usersService, emitter };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a majority_die room without escrow', async () => {
    const { service, prisma } = makeService();
    jest.spyOn(service as any, 'emitLobbyUpdate').mockResolvedValue(undefined);

    prisma.miniGameRoom.create.mockResolvedValue({
      id: 'room1',
      name: 'Lunch Revenge',
      mode: MiniGameMode.MAJORITY_DIE,
      stake: 0,
      entryStake: 20,
      hostUserId: 'u1',
      status: MiniGameRoomStatus.WAITING,
      participants: [{ userId: 'u1' }],
      maxPlayers: 20,
      createdAt: new Date('2026-03-18T15:00:00.000Z'),
    });

    const result = await service.createRoom('u1', {
      name: 'Lunch Revenge',
      entryStake: 20,
      maxPlayers: 20,
      stageTimeoutSec: 12,
    });

    expect(prisma.miniGameRoom.create).toHaveBeenCalled();
    expect(result.room.mode).toBe('majority_die');
    expect(result.room.stake).toBe(0);
  });

  it('rejects start when there are fewer than 2 players', async () => {
    const { service, prisma } = makeService();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'room1',
            mode: MiniGameMode.MAJORITY_DIE,
            hostUserId: 'u1',
            status: MiniGameRoomStatus.WAITING,
            participants: [
              {
                userId: 'u1',
                user: { coin: 100 },
              },
            ],
          }),
        },
      }),
    );

    await expect(service.startRoom('u1', 'room1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts a stage choice and emits a private ack', async () => {
    const { service, prisma, emitter } = makeService();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'room1',
            mode: MiniGameMode.MAJORITY_DIE,
            status: MiniGameRoomStatus.PLAYING,
            participants: [{ id: 'p1', userId: 'u1', alive: true }],
            majorityDieStages: [
              {
                id: 'stage1',
                stageNumber: 1,
                status: MiniGameRoundStatus.OPEN,
              },
            ],
          }),
        },
        majorityDieStageSubmission: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'sub1',
            choice: MajorityDieChoice.LEFT,
            submittedAt: new Date('2026-03-18T15:00:05.000Z'),
          }),
        },
      }),
    );

    await service.submitChoice('u1', 'room1', 1, 'left');

    expect(emitter.emitUser).toHaveBeenCalledWith(
      'u1',
      'game:choice_ack',
      expect.objectContaining({
        roomId: 'room1',
        stage: 1,
        accepted: true,
      }),
    );
  });

  it('rejects submit when room does not exist', async () => {
    const { service, prisma } = makeService();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        miniGameRoom: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(service.submitChoice('u1', 'roomX', 1, 'left')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
