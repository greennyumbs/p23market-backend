import { IsString, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BankOperationDto {
  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'top up', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
