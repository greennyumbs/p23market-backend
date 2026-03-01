import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomStatus, TransactionType } from '@prisma/client';

@Injectable()
export class ArenaService {
  constructor(private prisma: PrismaService) {}

  async createRoom(ownerId: string, amount: number, choice: string, name?: string) {
    if (amount < 5 || amount % 5 !== 0) {
      throw new BadRequestException('Amount minimum is 5 and must be step of 5');
    }
    const validChoices = ['rock', 'paper', 'scissors'];
    if (!validChoices.includes(choice.toLowerCase())) {
      throw new BadRequestException('Invalid choice');
    }

    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({ where: { id: ownerId } });
      if (!owner || owner.coin < amount) {
        throw new BadRequestException('Insufficient balance to create room');
      }

      // Deduct escrow
      await tx.user.update({
        where: { id: ownerId },
        data: { coin: { decrement: amount } },
      });

      // Log escrow
      await tx.transaction.create({
        data: {
          type: TransactionType.ARENA_ESCROW,
          fromUserId: ownerId,
          amount,
          note: `Escrow for Arena Room: ${name || 'Unnamed'}`,
        },
      });

      return tx.arenaRoom.create({
        data: {
          ownerId,
          name,
          amount,
          choice: choice.toLowerCase(),
        },
      });
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

  async joinRoom(challengerId: string, roomId: string, challengerChoice: string) {
    const validChoices = ['rock', 'paper', 'scissors'];
    if (!validChoices.includes(challengerChoice.toLowerCase())) {
      throw new BadRequestException('Invalid choice');
    }

    return this.prisma.$transaction(async (tx) => {
      // Locking the room for update to prevent race conditions (queuing)
      const room = await tx.arenaRoom.findUnique({
        where: { id: roomId },
      });

      if (!room) throw new NotFoundException('Room not found');
      if (room.status !== RoomStatus.OPEN) throw new BadRequestException('Room is not open');
      if (room.ownerId === challengerId) throw new BadRequestException('Cannot join your own room');

      const challenger = await tx.user.findUnique({ where: { id: challengerId } });
      if (!challenger || challenger.coin < room.amount) {
        throw new BadRequestException('Insufficient balance to join room');
      }

      // Deduct challenger amount
      await tx.user.update({
        where: { id: challengerId },
        data: { coin: { decrement: room.amount } },
      });

      // Log challenger escrow
      await tx.transaction.create({
        data: {
          type: TransactionType.ARENA_ESCROW,
          fromUserId: challengerId,
          amount: room.amount,
          note: `Escrow for joining Arena Room: ${room.id}`,
        },
      });

      const ownerChoice = room.choice;
      const result = this.resolveMatch(ownerChoice, challengerChoice.toLowerCase());

      let winnerUserId: string | null = null;
      let loserUserId: string | null = null;

      if (result === 'win') {
        winnerUserId = room.ownerId;
        loserUserId = challengerId;
      } else if (result === 'lose') {
        winnerUserId = challengerId;
        loserUserId = room.ownerId;
      }

      if (winnerUserId && loserUserId) {
        const totalPot = room.amount * 2;
        // Winner gets the total pot
        await tx.user.update({
          where: { id: winnerUserId },
          data: { coin: { increment: totalPot } },
        });

        // Log the win
        await tx.transaction.create({
          data: {
            type: TransactionType.ARENA,
            toUserId: winnerUserId,
            fromUserId: loserUserId,
            amount: totalPot,
            note: `Arena Win: ${ownerChoice} vs ${challengerChoice}`,
          },
        });
      } else {
        // Draw: Refund both
        await tx.user.update({
          where: { id: room.ownerId },
          data: { coin: { increment: room.amount } },
        });
        await tx.user.update({
          where: { id: challengerId },
          data: { coin: { increment: room.amount } },
        });

        await tx.transaction.create({
          data: {
            type: TransactionType.ARENA_REFUND,
            toUserId: room.ownerId,
            amount: room.amount,
            note: `Arena Draw Refund: ${room.id}`,
          },
        });
        await tx.transaction.create({
          data: {
            type: TransactionType.ARENA_REFUND,
            toUserId: challengerId,
            amount: room.amount,
            note: `Arena Draw Refund: ${room.id}`,
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

  private resolveMatch(choice1: string, choice2: string): 'win' | 'lose' | 'draw' {
    if (choice1 === choice2) return 'draw';
    if (
      (choice1 === 'rock' && choice2 === 'scissors') ||
      (choice1 === 'paper' && choice2 === 'rock') ||
      (choice1 === 'scissors' && choice2 === 'paper')
    ) {
      return 'win';
    }
    return 'lose';
  }
}
