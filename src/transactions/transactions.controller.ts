import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { TransactionType, User } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TransferDto } from './dto/transfer.dto';
import { BankOperationDto } from './dto/bank-operation.dto';

@ApiTags('v1/transactions')
@ApiBearerAuth()
@Controller('api/v1')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post('transfers')
  @ApiOperation({ summary: 'Create transfer from current user to receiver' })
  async transfer(@GetUser('id') userId: string, @Body() body: TransferDto) {
    const transaction = await this.transactionsService.transfer(
      userId,
      body.receiverId,
      body.amount,
      body.note,
    );
    return { ok: true, transaction };
  }

  @Post('bank/borrow')
  @ApiOperation({ summary: 'Borrow from bank' })
  async borrow(@GetUser('id') userId: string, @Body() body: BankOperationDto) {
    const { transaction, user } = await this.transactionsService.borrow(
      userId,
      body.amount,
      body.note,
    );
    return {
      ok: true,
      coin: user.coin,
      bankDebt: user.bankDebt,
      transactionId: transaction.id,
    };
  }

  @Post('bank/repay')
  @ApiOperation({ summary: 'Repay bank debt' })
  async repay(@GetUser('id') userId: string, @Body() body: BankOperationDto) {
    const { transaction, user } = await this.transactionsService.repay(
      userId,
      body.amount,
      body.note,
    );
    return {
      ok: true,
      coin: user.coin,
      bankDebt: user.bankDebt,
      transactionId: transaction.id,
    };
  }

  @Get('bank/me')
  @ApiOperation({ summary: 'Return current bank summary' })
  getBankMe(@GetUser() user: User) {
    return {
      coin: user.coin,
      bankDebt: user.bankDebt,
      net: user.coin - user.bankDebt,
      exchangeRate: 10,
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Public ledger records' })
  async findAll(
    @Query('type') type?: TransactionType,
    @Query('playerId') playerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.transactionsService.findAll({
      type,
      playerId,
      from: from ? parseInt(from) : undefined,
      to: to ? parseInt(to) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        createdAt: Math.floor(item.createdAt.getTime() / 1000),
      })),
    };
  }
}
