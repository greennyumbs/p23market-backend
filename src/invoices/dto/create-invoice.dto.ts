import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'u4' })
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  amount: number;

  @ApiProperty({ example: 'table A', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
