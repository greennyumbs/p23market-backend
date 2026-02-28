import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinRoomDto {
  @ApiProperty({ example: 'paper', enum: ['rock', 'paper', 'scissors'] })
  @IsString()
  @IsNotEmpty()
  choice: string;
}
