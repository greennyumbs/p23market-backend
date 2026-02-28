import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'player1' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '1234', minLength: 4 })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @ApiProperty({ example: 'Player One' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({ example: 1, minimum: 0, maximum: 24 })
  @IsInt()
  @Min(0)
  @Max(24)
  avatarIndex: number;
}
