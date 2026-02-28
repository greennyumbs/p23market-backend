import { PrismaService } from '../prisma/prisma.service';
import { Transaction } from '@prisma/client';
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
export declare class DashboardService {
    private prisma;
    constructor(prisma: PrismaService);
    getDashboardData(): Promise<DashboardData>;
}
