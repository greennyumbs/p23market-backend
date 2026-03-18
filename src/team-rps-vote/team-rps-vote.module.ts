import { Module } from '@nestjs/common';
import { MajorityDieService } from '../majority-die/majority-die.service';
import { MultiplayerController } from '../multiplayer/multiplayer.controller';
import { MultiplayerService } from '../multiplayer/multiplayer.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TeamRpsVoteController } from './team-rps-vote.controller';
import { TeamRpsVoteGateway } from './team-rps-vote.gateway';
import { TeamRpsVoteService } from './team-rps-vote.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TeamRpsVoteController, MultiplayerController],
  providers: [
    TeamRpsVoteService,
    MajorityDieService,
    MultiplayerService,
    TeamRpsVoteGateway,
  ],
  exports: [TeamRpsVoteService, MajorityDieService, MultiplayerService],
})
export class TeamRpsVoteModule {}
