import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMultiplayerRoomDto {
  @ApiPropertyOptional({ example: 'Lunch Revenge' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiProperty({ example: 'majority_die', enum: ['majority_die', 'team_rps_vote'] })
  @IsString()
  @IsIn(['majority_die', 'team_rps_vote'])
  mode: string;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(5)
  entryStake: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  maxPlayers?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  stageTimeoutSec?: number;
}
