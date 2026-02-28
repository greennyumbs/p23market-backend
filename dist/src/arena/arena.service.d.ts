import { PrismaService } from '../prisma/prisma.service';
export declare class ArenaService {
    private prisma;
    constructor(prisma: PrismaService);
    createRoom(ownerId: string, amount: number, choice: string): Promise<{
        id: string;
        createdAt: Date;
        amount: number;
        choice: string;
        status: import(".prisma/client").$Enums.RoomStatus;
        ownerId: string;
    }>;
    findAllRooms(): Promise<({
        owner: {
            displayName: string;
            avatarIndex: number;
        };
    } & {
        id: string;
        createdAt: Date;
        amount: number;
        choice: string;
        status: import(".prisma/client").$Enums.RoomStatus;
        ownerId: string;
    })[]>;
    joinRoom(challengerId: string, roomId: string, challengerChoice: string): Promise<{
        id: string;
        amount: number;
        ownerId: string;
        ownerChoice: string;
        challengerChoice: string;
        resolvedAt: Date;
        roomId: string;
        challengerId: string;
        winnerUserId: string | null;
    }>;
    findAllMatches(): Promise<{
        id: string;
        amount: number;
        ownerId: string;
        ownerChoice: string;
        challengerChoice: string;
        resolvedAt: Date;
        roomId: string;
        challengerId: string;
        winnerUserId: string | null;
    }[]>;
    private resolveMatch;
}
