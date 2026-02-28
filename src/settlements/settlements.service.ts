import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  async run(userId: string) {
    const users = await this.prisma.user.findMany();

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          runByUserId: userId,
        },
      });

      const snapshots = await Promise.all(
        users.map((user) =>
          tx.settlementSnapshot.create({
            data: {
              settlementId: settlement.id,
              userId: user.id,
              coin: user.coin,
              bankDebt: user.bankDebt,
              net: user.coin - user.bankDebt,
            },
          }),
        ),
      );

      return { ...settlement, players: snapshots };
    });
  }

  async findAll() {
    const items = await this.prisma.settlement.findMany({
      include: {
        snapshots: {
          include: {
            user: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        createdAt: Math.floor(item.createdAt.getTime() / 1000),
        runByUserId: item.runByUserId,
        players: item.snapshots.map((s) => ({
          playerId: s.userId,
          username: s.user.username,
          displayName: s.user.displayName,
          coin: s.coin,
          bankDebt: s.bankDebt,
          net: s.net,
        })),
      })),
    };
  }
}
