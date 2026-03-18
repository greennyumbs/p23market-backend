import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { CreateMultiplayerRoomDto } from './dto/create-multiplayer-room.dto';
import { MultiplayerService } from './multiplayer.service';

@ApiTags('v1/multiplayer')
@ApiBearerAuth()
@Controller('api/v1/multiplayer')
@UseGuards(JwtAuthGuard)
export class MultiplayerController {
  constructor(private readonly multiplayerService: MultiplayerService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'List waiting multiplayer rooms' })
  async findRooms(
    @Query('mode') mode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.multiplayerService.listRooms({
      mode,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Create a multiplayer room' })
  async createRoom(
    @GetUser('id') userId: string,
    @Body() body: CreateMultiplayerRoomDto,
  ) {
    return this.multiplayerService.createRoom(userId, body);
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get multiplayer room detail snapshot' })
  async findRoom(@Param('roomId') roomId: string) {
    return this.multiplayerService.getRoomDetail(roomId);
  }
}
