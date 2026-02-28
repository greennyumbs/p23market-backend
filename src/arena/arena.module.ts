import { Module } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaController } from './arena.controller';

@Module({
  providers: [ArenaService],
  controllers: [ArenaController],
})
export class ArenaModule {}
