import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/get-user.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('v1/settlement')
@ApiBearerAuth()
@Controller('api/v1/settlement')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SettlementsController {
  constructor(private settlementsService: SettlementsService) {}

  @Post('run')
  @Roles(Role.ADMIN)
  async run(@GetUser('id') userId: string) {
    const result = await this.settlementsService.run(userId);
    return {
      ...result,
      createdAt: Math.floor(result.createdAt.getTime() / 1000),
      players: result.players.map((p) => ({
        playerId: p.userId,
        coin: p.coin,
        bankDebt: p.bankDebt,
        net: p.net,
      })),
    };
  }

  @Get('runs')
  async findAll() {
    return this.settlementsService.findAll();
  }
}
