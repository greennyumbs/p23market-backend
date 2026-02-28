import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Transaction } from '@prisma/client';

export interface DashboardData {
  totals: {
    totalCoin: number;
  };
  topWinner: {
    playerId: string;
    displayName: string;
    net: number;
  } | null;
  topLoser: {
    playerId: string;
    displayName: string;
    net: number;
  } | null;
  recentTransactions: (Omit<Transaction, 'createdAt'> & {
    createdAt: number;
  })[];
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(): Promise<DashboardData> {
    const users: User[] = await this.prisma.user.findMany();

    let totalCoin = 0;
    let topWinner: User | null = null;
    let topLoser: User | null = null;

    for (const user of users) {
      totalCoin += user.coin;
      const net = user.coin - user.bankDebt;

      if (!topWinner || net > topWinner.coin - topWinner.bankDebt) {
        topWinner = user;
      }
      if (!topLoser || net < topLoser.coin - topLoser.bankDebt) {
        topLoser = user;
      }
    }

    const recentTransactions: Transaction[] =
      await this.prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

    return {
      totals: {
        totalCoin,
      },
      topWinner: topWinner
        ? {
            playerId: topWinner.id,
            displayName: topWinner.displayName,
            net: topWinner.coin - topWinner.bankDebt,
          }
        : null,
      topLoser: topLoser
        ? {
            playerId: topLoser.id,
            displayName: topLoser.displayName,
            net: topLoser.coin - topLoser.bankDebt,
          }
        : null,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: t.amount,
        note: t.note,
        createdAt: Math.floor(t.createdAt.getTime() / 1000),
      })),
    };
  }
}
