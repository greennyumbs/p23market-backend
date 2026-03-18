import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MiniGameMode, MiniGameRoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMultiplayerRoomDto } from './dto/create-multiplayer-room.dto';
import { TeamRpsVoteService } from '../team-rps-vote/team-rps-vote.service';
import { MajorityDieService } from '../majority-die/majority-die.service';

@Injectable()
export class MultiplayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamRpsVoteService: TeamRpsVoteService,
    private readonly majorityDieService: MajorityDieService,
  ) {}

  async listRooms(query: { mode?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = {
      status: MiniGameRoomStatus.WAITING,
      ...(query.mode ? { mode: this.parseMode(query.mode) } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.miniGameRoom.findMany({
        where,
        include: {
          hostUser: {
            select: {
              displayName: true,
              avatarIndex: true,
            },
          },
          participants: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.miniGameRoom.count({ where }),
    ]);

    return {
      items: items.map((room) => ({
        id: room.id,
        name: room.name,
        mode: room.mode.toLowerCase(),
        stake: room.stake,
        entryStake: room.entryStake,
        hostUserId: room.hostUserId,
        hostDisplayName: room.hostUser.displayName,
        hostAvatarIndex: room.hostUser.avatarIndex,
        status: room.status.toLowerCase(),
        maxPlayers: room.maxPlayers,
        players: room.participants.length,
        createdAt: Math.floor(room.createdAt.getTime() / 1000),
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async createRoom(userId: string, body: CreateMultiplayerRoomDto) {
    const mode = this.parseMode(body.mode);

    if (mode === MiniGameMode.TEAM_RPS_VOTE) {
      const room = await this.teamRpsVoteService.createRoom(
        userId,
        body.entryStake,
        body.name,
      );
      return {
        ok: true,
        room: {
          id: room.roomId,
          name: room.name,
          mode: room.mode,
          stake: room.stake,
          entryStake: room.entryStake,
          hostUserId: room.hostUserId,
          status: room.status,
          players: room.players,
          maxPlayers: 10,
          createdAt: room.updatedAt,
        },
      };
    }

    return this.majorityDieService.createRoom(userId, body);
  }

  async getRoomDetail(roomId: string) {
    const room = await this.prisma.miniGameRoom.findUnique({
      where: { id: roomId },
      select: { mode: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.mode === MiniGameMode.TEAM_RPS_VOTE) {
      return { room: await this.teamRpsVoteService.getRoomState(roomId) };
    }

    return this.majorityDieService.getRoomDetail(roomId);
  }

  async getRoomMode(roomId: string) {
    const room = await this.prisma.miniGameRoom.findUnique({
      where: { id: roomId },
      select: { mode: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room.mode;
  }

  private parseMode(mode: string) {
    const normalized = mode.trim().toUpperCase();
    if (normalized === 'TEAM_RPS_VOTE') return MiniGameMode.TEAM_RPS_VOTE;
    if (normalized === 'MAJORITY_DIE') return MiniGameMode.MAJORITY_DIE;
    throw new BadRequestException('Unsupported multiplayer mode');
  }
}
