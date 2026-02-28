import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findOne(username: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(data: Prisma.UserCreateInput): Promise<User>;
    findAll(): Promise<{
        id: string;
        username: string;
        displayName: string;
        avatarIndex: number;
        role: import(".prisma/client").$Enums.Role;
        coin: number;
        bankDebt: number;
    }[]>;
}
