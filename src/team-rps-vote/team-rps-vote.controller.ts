import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { TeamRpsVoteService } from './team-rps-vote.service';
import { CreateTeamRpsVoteRoomDto } from './dto/create-team-rps-vote-room.dto';

@ApiTags('v1/team-rps-vote')
@ApiBearerAuth()
@Controller('api/v1/team-rps-vote')
@UseGuards(JwtAuthGuard)
export class TeamRpsVoteController {
  constructor(private readonly teamRpsVoteService: TeamRpsVoteService) {}

  @Post('rooms')
  @ApiOperation({ summary: 'Create a new team RPS vote room' })
  async createRoom(
    @GetUser('id') userId: string,
    @Body() body: CreateTeamRpsVoteRoomDto,
  ) {
    const room = await this.teamRpsVoteService.createRoom(
      userId,
      body.entryStake,
      body.name,
    );
    return { ok: true, room };
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List open team RPS vote rooms' })
  async findRooms() {
    const items = await this.teamRpsVoteService.listRooms();
    return { items };
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get room detail for team RPS vote' })
  async findRoom(@Param('roomId') roomId: string) {
    return this.teamRpsVoteService.getRoomState(roomId);
  }
}
