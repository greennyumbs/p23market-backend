import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TransferInvoiceDto {
  @ApiProperty({ example: 'u9' })
  @IsString()
  @IsNotEmpty()
  toUserId: string;

  @ApiProperty({ example: 'โอนหนี้โต๊ะ B' })
  @IsString()
  @IsNotEmpty()
  note: string;
}
