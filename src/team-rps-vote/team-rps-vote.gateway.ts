import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MiniGameMode } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MajorityDieService } from '../majority-die/majority-die.service';
import { MultiplayerService } from '../multiplayer/multiplayer.service';
import { TeamRpsVoteService } from './team-rps-vote.service';

type AuthenticatedSocket = Socket & {
  data: Socket['data'] & {
    user?: {
      id: string;
      username: string;
      displayName: string;
      avatarIndex: number;
    };
  };
};

@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: [
      'https://p23-market-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
})
export class TeamRpsVoteGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly teamRpsVoteService: TeamRpsVoteService,
    private readonly majorityDieService: MajorityDieService,
    private readonly multiplayerService: MultiplayerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    const emitter = {
      emitRoom: (roomId, event, payload) => {
        this.server.to(this.roomChannel(roomId)).emit(event, payload);
      },
      emitUser: (userId, event, payload) => {
        this.server.to(this.userChannel(userId)).emit(event, payload);
      },
      emitLobby: (mode: string, payload: unknown) => {
        this.server.to(this.lobbyChannel(mode)).emit('lobby:rooms_updated', payload);
      },
    };

    this.teamRpsVoteService.setEmitter(emitter);
    this.majorityDieService.setEmitter(emitter);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('socket:error', {
          code: 'UNAUTHORIZED',
          message: 'Missing token',
        });
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        username: string;
      }>(token, {
        secret:
          this.configService.get<string>('JWT_SECRET') ?? 'fallback-secret',
      });

      const user = await this.teamRpsVoteService.getSocketUser(payload.sub);
      client.data.user = user;
      await client.join(this.userChannel(user.id));
    } catch {
      client.emit('socket:error', {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
      client.disconnect();
    }
  }

  @SubscribeMessage('lobby:subscribe')
  async onLobbySubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { mode?: string },
  ) {
    await this.runHandler(client, async () => {
      const mode = `${body?.mode ?? ''}`.trim().toLowerCase();
      if (!mode) {
        throw new Error('Room not found');
      }
      await client.join(this.lobbyChannel(mode));
    });
  }

  @SubscribeMessage('room:join')
  async onRoomJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string },
  ) {
    await this.runHandler(client, async () => {
      const user = this.requireUser(client);
      const roomId = body?.roomId ?? '';
      const mode = await this.multiplayerService.getRoomMode(roomId);
      const joined =
        mode === MiniGameMode.MAJORITY_DIE
          ? await this.majorityDieService.joinRoom(user.id, roomId)
          : await this.teamRpsVoteService.joinRoom(user.id, roomId);
      await client.join(this.roomChannel(joined.room.id));
      client.emit('room:joined', joined);
    });
  }

  @SubscribeMessage('room:leave')
  async onRoomLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string },
  ) {
    await this.runHandler(client, async () => {
      const user = this.requireUser(client);
      const roomId = body?.roomId ?? '';
      const mode = await this.multiplayerService.getRoomMode(roomId);
      if (mode === MiniGameMode.MAJORITY_DIE) {
        await this.majorityDieService.leaveRoom(user.id, roomId);
      } else {
        await this.teamRpsVoteService.leaveRoom(user.id, roomId);
      }
      await client.leave(this.roomChannel(roomId));
    });
  }

  @SubscribeMessage('team:choose')
  async onChooseTeam(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; team?: string },
  ) {
    await this.runHandler(client, async () => {
      const user = this.requireUser(client);
      const mode = await this.multiplayerService.getRoomMode(body?.roomId ?? '');
      if (mode !== MiniGameMode.TEAM_RPS_VOTE) {
        throw new Error('Team selection closed');
      }
      await this.teamRpsVoteService.chooseTeam(user.id, body?.roomId, body?.team);
    });
  }

  @SubscribeMessage('room:start')
  async onStartRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string },
  ) {
    await this.runHandler(client, async () => {
      const user = this.requireUser(client);
      const roomId = body?.roomId ?? '';
      const mode = await this.multiplayerService.getRoomMode(roomId);
      if (mode === MiniGameMode.MAJORITY_DIE) {
        await this.majorityDieService.startRoom(user.id, roomId);
      } else {
        await this.teamRpsVoteService.startRoom(user.id, roomId);
      }
    });
  }

  @SubscribeMessage('team_rps:submit_vote')
  async onSubmitVote(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; round?: number; choice?: string },
  ) {
    await this.runHandler(client, async () => {
      const user = this.requireUser(client);
      await this.teamRpsVoteService.submitVote(
        user.id,
        body?.roomId,
        body?.round,
        body?.choice,
      );
    });
  }

  @SubscribeMessage('game:submit_choice')
  async onSubmitChoice(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; stage?: number; choice?: string },
  ) {
    await this.runHandler(client, async () => {
      const user = this.requireUser(client);
      const roomId = body?.roomId ?? '';
      const mode = await this.multiplayerService.getRoomMode(roomId);
      if (mode !== MiniGameMode.MAJORITY_DIE) {
        throw new Error('Submission closed');
      }
      await this.majorityDieService.submitChoice(
        user.id,
        roomId,
        body?.stage,
        body?.choice,
      );
    });
  }

  private async runHandler(
    client: AuthenticatedSocket,
    fn: () => Promise<void>,
  ) {
    try {
      await fn();
    } catch (error) {
      const payload =
        error instanceof Error
          ? {
              code: this.teamRpsVoteService.mapErrorCode(error.message),
              message: error.message,
            }
          : {
              code: 'INTERNAL_ERROR',
              message: 'Unexpected error',
            };
      client.emit('socket:error', payload);
    }
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const authHeader = client.handshake.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.length > 0) {
      return authHeader.replace(/^Bearer\s+/i, '');
    }

    return null;
  }

  private requireUser(client: AuthenticatedSocket) {
    if (!client.data.user) {
      throw new Error('Unauthorized');
    }
    return client.data.user;
  }

  private roomChannel(roomId: string) {
    return `team-rps-vote:room:${roomId}`;
  }

  private userChannel(userId: string) {
    return `team-rps-vote:user:${userId}`;
  }

  private lobbyChannel(mode: string) {
    return `multiplayer:lobby:${mode}`;
  }
}
