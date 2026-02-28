import { TransactionsService } from './transactions.service';
import { TransactionType, User } from '@prisma/client';
import { TransferDto } from './dto/transfer.dto';
import { BankOperationDto } from './dto/bank-operation.dto';
export declare class TransactionsController {
    private transactionsService;
    constructor(transactionsService: TransactionsService);
    transfer(userId: string, body: TransferDto): Promise<{
        ok: boolean;
        transaction: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TransactionType;
            fromUserId: string | null;
            toUserId: string | null;
            amount: number;
            note: string | null;
        };
    }>;
    borrow(userId: string, body: BankOperationDto): Promise<{
        ok: boolean;
        coin: number;
        bankDebt: number;
        transactionId: string;
    }>;
    repay(userId: string, body: BankOperationDto): Promise<{
        ok: boolean;
        coin: number;
        bankDebt: number;
        transactionId: string;
    }>;
    getBankMe(user: User): {
        coin: number;
        bankDebt: number;
        net: number;
        exchangeRate: number;
    };
    findAll(type?: TransactionType, playerId?: string, from?: string, to?: string, page?: string, limit?: string): Promise<{
        items: {
            createdAt: number;
            id: string;
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
