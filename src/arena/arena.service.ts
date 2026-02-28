import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomStatus, TransactionType } from '@prisma/client';

@Injectable()
export class ArenaService {
  constructor(private prisma: PrismaService) {}

  async createRoom(ownerId: string, amount: number, choice: string) {
    if (amount < 5 || amount % 5 !== 0) {
      throw new BadRequestException(
        'Amount minimum is 5 and must be step of 5',
      );
    }
    const validChoices = ['rock', 'paper', 'scissors'];
    if (!validChoices.includes(choice.toLowerCase())) {
      throw new BadRequestException('Invalid choice');
    }

    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.coin < amount) {
      throw new BadRequestException('Insufficient balance to create room');
    }

    return this.prisma.arenaRoom.create({
      data: {
        ownerId,
        amount,
        choice: choice.toLowerCase(),
      },
    });
  }

  async findAllRooms() {
    return this.prisma.arenaRoom.findMany({
      where: { status: RoomStatus.OPEN },
      include: {
        owner: {
          select: {
            displayName: true,
            avatarIndex: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async joinRoom(
    challengerId: string,
    roomId: string,
    challengerChoice: string,
  ) {
    const validChoices = ['rock', 'paper', 'scissors'];
    if (!validChoices.includes(challengerChoice.toLowerCase())) {
      throw new BadRequestException('Invalid choice');
    }

    const room = await this.prisma.arenaRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== RoomStatus.OPEN)
      throw new BadRequestException('Room is not open');
    if (room.ownerId === challengerId)
      throw new BadRequestException('Cannot join your own room');

    const challenger = await this.prisma.user.findUnique({
      where: { id: challengerId },
    });
    if (!challenger || challenger.coin < room.amount) {
      throw new BadRequestException('Insufficient balance to join room');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: room.ownerId },
    });
    if (!owner || owner.coin < room.amount) {
      throw new BadRequestException('Owner insufficient balance (unexpected)');
    }

    const ownerChoice = room.choice;
    const result = this.resolveMatch(
      ownerChoice,
      challengerChoice.toLowerCase(),
    );

    return this.prisma.$transaction(async (tx) => {
      let winnerUserId: string | null = null;
      let loserUserId: string | null = null;

      if (result === 'win') {
        // Owner wins
        winnerUserId = room.ownerId;
        loserUserId = challengerId;
      } else if (result === 'lose') {
        // Challenger wins
        winnerUserId = challengerId;
        loserUserId = room.ownerId;
      }

      if (winnerUserId && loserUserId) {
        // Update balances
        await tx.user.update({
          where: { id: winnerUserId },
          data: { coin: { increment: room.amount } },
        });
        await tx.user.update({
          where: { id: loserUserId },
          data: { coin: { decrement: room.amount } },
        });

        // Create transaction logs
        await tx.transaction.create({
          data: {
            type: TransactionType.ARENA,
            fromUserId: loserUserId,
            toUserId: winnerUserId,
            amount: room.amount,
            note: `Arena: ${ownerChoice} vs ${challengerChoice}`,
          },
        });
      }

      const match = await tx.arenaMatch.create({
        data: {
          roomId: room.id,
          ownerId: room.ownerId,
          challengerId,
          amount: room.amount,
          ownerChoice,
          challengerChoice: challengerChoice.toLowerCase(),
          winnerUserId,
        },
      });

      await tx.arenaRoom.update({
        where: { id: roomId },
        data: { status: RoomStatus.RESOLVED },
      });

      return match;
    });
  }

  async findAllMatches() {
    return this.prisma.arenaMatch.findMany({
      orderBy: { resolvedAt: 'desc' },
      take: 50,
    });
  }

  private resolveMatch(
    choice1: string,
    choice2: string,
  ): 'win' | 'lose' | 'draw' {
    if (choice1 === choice2) return 'draw';
    if (
      (choice1 === 'rock' && choice2 === 'scissors') ||
      (choice1 === 'paper' && choice2 === 'rock') ||
      (choice1 === 'scissors' && choice2 === 'paper')
    ) {
      return 'win'; // choice1 wins
    }
    return 'lose'; // choice1 loses
  }
}
