import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTeamRpsVoteRoomDto {
  @ApiPropertyOptional({ example: 'RPS Finals' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiProperty({ example: 20, description: 'Stake per player in M-coin' })
  @IsInt()
  @Min(5)
  entryStake: number;
}
