import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    note?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    if (fromUserId === toUserId)
      throw new BadRequestException('Cannot transfer to yourself');

    const fromUser = await this.prisma.user.findUnique({
      where: { id: fromUserId },
    });
    if (!fromUser || fromUser.coin < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const toUser = await this.prisma.user.findUnique({
      where: { id: toUserId },
    });
    if (!toUser) throw new NotFoundException('Receiver not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: fromUserId },
        data: { coin: { decrement: amount } },
      });

      await tx.user.update({
        where: { id: toUserId },
        data: { coin: { increment: amount } },
      });

      return tx.transaction.create({
        data: {
          type: TransactionType.TRANSFER,
          fromUserId,
          toUserId,
          amount,
          note,
        },
      });
    });
  }

  async borrow(userId: string, amount: number, note?: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          coin: { increment: amount },
          bankDebt: { increment: amount },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.BORROW,
          toUserId: userId,
          amount,
          note,
        },
      });

      return { transaction, user };
    });
  }

  async repay(userId: string, amount: number, note?: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.coin < amount) {
      throw new BadRequestException('Insufficient balance to repay');
    }
    if (user.bankDebt < amount) {
      throw new BadRequestException('Repay amount exceeds debt');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coin: { decrement: amount },
          bankDebt: { decrement: amount },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.REPAY,
          fromUserId: userId,
          amount,
          note,
        },
      });

      return { transaction, user: updatedUser };
    });
  }

  async findAll(query: {
    type?: TransactionType;
    playerId?: string;
    from?: number;
    to?: number;
    page?: number;
    limit?: number;
  }) {
    const { type, playerId, from, to, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};
    if (type) where.type = type;
    if (playerId) {
      where.OR = [{ fromUserId: playerId }, { toUserId: playerId }];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from * 1000);
      if (to) where.createdAt.lte = new Date(to * 1000);
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: Prisma.SortOrder.desc },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }
}
