import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'The Arena', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 50, description: 'Minimum 5, step 5' })
  @IsInt()
  @Min(5)
  amount: number;

  @ApiProperty({ example: 'rock', enum: ['rock', 'paper', 'scissors'] })
  @IsString()
  @IsNotEmpty()
  choice: string;
}
