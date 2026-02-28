"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArenaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let ArenaService = class ArenaService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createRoom(ownerId, amount, choice) {
        if (amount < 5 || amount % 5 !== 0) {
            throw new common_1.BadRequestException('Amount minimum is 5 and must be step of 5');
        }
        const validChoices = ['rock', 'paper', 'scissors'];
        if (!validChoices.includes(choice.toLowerCase())) {
            throw new common_1.BadRequestException('Invalid choice');
        }
        const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
        if (!owner || owner.coin < amount) {
            throw new common_1.BadRequestException('Insufficient balance to create room');
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
            where: { status: client_1.RoomStatus.OPEN },
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
    async joinRoom(challengerId, roomId, challengerChoice) {
        const validChoices = ['rock', 'paper', 'scissors'];
        if (!validChoices.includes(challengerChoice.toLowerCase())) {
            throw new common_1.BadRequestException('Invalid choice');
        }
        const room = await this.prisma.arenaRoom.findUnique({
            where: { id: roomId },
        });
        if (!room)
            throw new common_1.NotFoundException('Room not found');
        if (room.status !== client_1.RoomStatus.OPEN)
            throw new common_1.BadRequestException('Room is not open');
        if (room.ownerId === challengerId)
            throw new common_1.BadRequestException('Cannot join your own room');
        const challenger = await this.prisma.user.findUnique({
            where: { id: challengerId },
        });
        if (!challenger || challenger.coin < room.amount) {
            throw new common_1.BadRequestException('Insufficient balance to join room');
        }
        const owner = await this.prisma.user.findUnique({
            where: { id: room.ownerId },
        });
        if (!owner || owner.coin < room.amount) {
            throw new common_1.BadRequestException('Owner insufficient balance (unexpected)');
        }
        const ownerChoice = room.choice;
        const result = this.resolveMatch(ownerChoice, challengerChoice.toLowerCase());
        return this.prisma.$transaction(async (tx) => {
            let winnerUserId = null;
            let loserUserId = null;
            if (result === 'win') {
                winnerUserId = room.ownerId;
                loserUserId = challengerId;
            }
            else if (result === 'lose') {
                winnerUserId = challengerId;
                loserUserId = room.ownerId;
            }
            if (winnerUserId && loserUserId) {
                await tx.user.update({
                    where: { id: winnerUserId },
                    data: { coin: { increment: room.amount } },
                });
                await tx.user.update({
                    where: { id: loserUserId },
                    data: { coin: { decrement: room.amount } },
                });
                await tx.transaction.create({
                    data: {
                        type: client_1.TransactionType.ARENA,
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
                data: { status: client_1.RoomStatus.RESOLVED },
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
    resolveMatch(choice1, choice2) {
        if (choice1 === choice2)
            return 'draw';
        if ((choice1 === 'rock' && choice2 === 'scissors') ||
            (choice1 === 'paper' && choice2 === 'rock') ||
            (choice1 === 'scissors' && choice2 === 'paper')) {
            return 'win';
        }
        return 'lose';
    }
};
exports.ArenaService = ArenaService;
exports.ArenaService = ArenaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ArenaService);
//# sourceMappingURL=arena.service.js.map