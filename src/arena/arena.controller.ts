import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';

@ApiTags('v1/arena')
@ApiBearerAuth()
@Controller('api/v1/arena')
@UseGuards(JwtAuthGuard)
export class ArenaController {
  constructor(private arenaService: ArenaService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'List open rooms for join' })
  async findAllRooms() {
    const rooms = await this.arenaService.findAllRooms();
    return {
      items: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        ownerId: r.ownerId,
        ownerDisplayName: r.owner.displayName,
        ownerAvatarIndex: r.owner.avatarIndex,
        amount: r.amount,
        status: r.status.toLowerCase(),
        createdAt: Math.floor(r.createdAt.getTime() / 1000),
      })),
    };
  }

  @Post('rooms')
  @ApiOperation({
    summary: 'Create room with fixed amount and hidden owner choice',
  })
  async createRoom(@GetUser('id') userId: string, @Body() body: CreateRoomDto) {
    const room = await this.arenaService.createRoom(
      userId,
      body.amount,
      body.choice,
      body.name,
    );
    return {
      ok: true,
      room: {
        id: room.id,
        name: room.name,
        ownerId: room.ownerId,
        amount: room.amount,
        status: room.status.toLowerCase(),
        createdAt: Math.floor(room.createdAt.getTime() / 1000),
      },
    };
  }

  @Post('rooms/:roomId/join')
  @ApiOperation({
    summary: 'Join room and submit challenger choice to resolve match',
  })
  async joinRoom(
    @GetUser('id') userId: string,
    @Param('roomId') roomId: string,
    @Body() body: JoinRoomDto,
  ) {
    const match = await this.arenaService.joinRoom(userId, roomId, body.choice);

    let outcome: 'win' | 'lose' | 'draw' = 'draw';
    if (match.winnerUserId === userId) outcome = 'win';
    else if (match.winnerUserId && match.winnerUserId !== userId)
      outcome = 'lose';

    return {
      ok: true,
      match: {
        id: match.id,
        roomId: match.roomId,
        ownerId: match.ownerId,
        challengerId: match.challengerId,
        amount: match.amount,
        ownerChoice: match.ownerChoice,
        challengerChoice: match.challengerChoice,
        result: {
          winnerUserId: match.winnerUserId,
          loserUserId: match.winnerUserId
            ? match.winnerUserId === match.ownerId
              ? match.challengerId
              : match.ownerId
            : null,
          outcome,
        },
        resolvedAt: Math.floor(match.resolvedAt.getTime() / 1000),
      },
    };
  }

  @Get('matches')
  @ApiOperation({ summary: 'List mini-game match history' })
  async findAllMatches() {
    const matches = await this.arenaService.findAllMatches();
    return {
      items: matches.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        ownerId: m.ownerId,
        challengerId: m.challengerId,
        amount: m.amount,
        ownerChoice: m.ownerChoice,
        challengerChoice: m.challengerChoice,
        winnerUserId: m.winnerUserId,
        resolvedAt: Math.floor(m.resolvedAt.getTime() / 1000),
      })),
    };
  }
}
