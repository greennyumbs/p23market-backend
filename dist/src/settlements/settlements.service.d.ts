import { PrismaService } from '../prisma/prisma.service';
export declare class SettlementsService {
    private prisma;
    constructor(prisma: PrismaService);
    run(userId: string): Promise<{
        players: {
            id: string;
            coin: number;
            bankDebt: number;
            net: number;
            settlementId: string;
            userId: string;
        }[];
        id: string;
        createdAt: Date;
        runByUserId: string;
    }>;
    findAll(): Promise<{
        items: {
            id: string;
            createdAt: number;
            runByUserId: string;
            players: {
                playerId: string;
                username: string;
                displayName: string;
                coin: number;
                bankDebt: number;
                net: number;
            }[];
        }[];
    }>;
}
