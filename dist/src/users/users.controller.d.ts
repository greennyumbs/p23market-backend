import { UsersService } from './users.service';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<{
        items: {
            net: number;
            id: string;
            username: string;
            displayName: string;
            avatarIndex: number;
            role: import(".prisma/client").$Enums.Role;
            coin: number;
            bankDebt: number;
        }[];
    }>;
    findOne(id: string): Promise<{
        net: number;
        id: string;
        username: string;
        displayName: string;
        avatarIndex: number;
        role: import(".prisma/client").$Enums.Role;
        coin: number;
        bankDebt: number;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    getLeaderboard(): Promise<{
        items: {
            playerId: string;
            displayName: string;
            coin: number;
            bankDebt: number;
            net: number;
            rank: number;
        }[];
    }>;
}
