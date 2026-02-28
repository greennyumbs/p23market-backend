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
exports.SettlementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SettlementsService = class SettlementsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async run(userId) {
        const users = await this.prisma.user.findMany();
        return this.prisma.$transaction(async (tx) => {
            const settlement = await tx.settlement.create({
                data: {
                    runByUserId: userId,
                },
            });
            const snapshots = await Promise.all(users.map((user) => tx.settlementSnapshot.create({
                data: {
                    settlementId: settlement.id,
                    userId: user.id,
                    coin: user.coin,
                    bankDebt: user.bankDebt,
                    net: user.coin - user.bankDebt,
                },
            })));
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
};
exports.SettlementsService = SettlementsService;
exports.SettlementsService = SettlementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettlementsService);
//# sourceMappingURL=settlements.service.js.map