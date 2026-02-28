import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({ example: 'u4' })
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'table A', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
