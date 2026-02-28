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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardData() {
        const users = await this.prisma.user.findMany();
        let totalCoin = 0;
        let topWinner = null;
        let topLoser = null;
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
        const recentTransactions = await this.prisma.transaction.findMany({
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
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map