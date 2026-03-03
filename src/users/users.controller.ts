import {
  Controller,
  Get,
  Param,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('v1/players')
@Controller('api/v1')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('players')
  async findAll() {
    const items = await this.usersService.findAll(Role.PLAYER);
    return { items: items.map((u) => ({ ...u, net: u.coin - u.bankDebt })) };
  }

  @Get('players/:id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return { ...result, net: user.coin - user.bankDebt };
  }

  @Get('leaderboard')
  async getLeaderboard() {
    const users = await this.usersService.findAll(Role.PLAYER);
    const ranked = users
      .map((u) => ({
        playerId: u.id,
        displayName: u.displayName,
        coin: u.coin,
        bankDebt: u.bankDebt,
        net: u.coin - u.bankDebt,
      }))
      .sort((a, b) => b.net - a.net)
      .map((u, index) => ({ rank: index + 1, ...u }));

    return { items: ranked };
  }
}
