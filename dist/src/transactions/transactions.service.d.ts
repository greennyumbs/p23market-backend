import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';
export declare class TransactionsService {
    private prisma;
    constructor(prisma: PrismaService);
    transfer(fromUserId: string, toUserId: string, amount: number, note?: string): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TransactionType;
        fromUserId: string | null;
        toUserId: string | null;
        amount: number;
        note: string | null;
    }>;
    borrow(userId: string, amount: number, note?: string): Promise<{
        transaction: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TransactionType;
            fromUserId: string | null;
            toUserId: string | null;
            amount: number;
            note: string | null;
        };
        user: {
            id: string;
            username: string;
            passwordHash: string;
            displayName: string;
            avatarIndex: number;
            role: import(".prisma/client").$Enums.Role;
            coin: number;
            bankDebt: number;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    repay(userId: string, amount: number, note?: string): Promise<{
        transaction: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TransactionType;
            fromUserId: string | null;
            toUserId: string | null;
            amount: number;
            note: string | null;
        };
        user: {
            id: string;
            username: string;
            passwordHash: string;
            displayName: string;
            avatarIndex: number;
            role: import(".prisma/client").$Enums.Role;
            coin: number;
            bankDebt: number;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    findAll(query: {
        type?: TransactionType;
        playerId?: string;
        from?: number;
        to?: number;
        page?: number;
        limit?: number;
    }): Promise<{
        items: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TransactionType;
            fromUserId: string | null;
            toUserId: string | null;
            amount: number;
            note: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
}
