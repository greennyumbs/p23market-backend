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
exports.TransactionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let TransactionsService = class TransactionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async transfer(fromUserId, toUserId, amount, note) {
        if (amount <= 0)
            throw new common_1.BadRequestException('Amount must be positive');
        if (fromUserId === toUserId)
            throw new common_1.BadRequestException('Cannot transfer to yourself');
        const fromUser = await this.prisma.user.findUnique({
            where: { id: fromUserId },
        });
        if (!fromUser || fromUser.coin < amount) {
            throw new common_1.BadRequestException('Insufficient balance');
        }
        const toUser = await this.prisma.user.findUnique({
            where: { id: toUserId },
        });
        if (!toUser)
            throw new common_1.NotFoundException('Receiver not found');
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
                    type: client_1.TransactionType.TRANSFER,
                    fromUserId,
                    toUserId,
                    amount,
                    note,
                },
            });
        });
    }
    async borrow(userId, amount, note) {
        if (amount <= 0)
            throw new common_1.BadRequestException('Amount must be positive');
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
                    type: client_1.TransactionType.BORROW,
                    toUserId: userId,
                    amount,
                    note,
                },
            });
            return { transaction, user };
        });
    }
    async repay(userId, amount, note) {
        if (amount <= 0)
            throw new common_1.BadRequestException('Amount must be positive');
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.coin < amount) {
            throw new common_1.BadRequestException('Insufficient balance to repay');
        }
        if (user.bankDebt < amount) {
            throw new common_1.BadRequestException('Repay amount exceeds debt');
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
                    type: client_1.TransactionType.REPAY,
                    fromUserId: userId,
                    amount,
                    note,
                },
            });
            return { transaction, user: updatedUser };
        });
    }
    async findAll(query) {
        const { type, playerId, from, to, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (type)
            where.type = type;
        if (playerId) {
            where.OR = [{ fromUserId: playerId }, { toUserId: playerId }];
        }
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = new Date(from * 1000);
            if (to)
                where.createdAt.lte = new Date(to * 1000);
        }
        const [items, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: client_1.Prisma.SortOrder.desc },
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
};
exports.TransactionsService = TransactionsService;
exports.TransactionsService = TransactionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TransactionsService);
//# sourceMappingURL=transactions.service.js.map