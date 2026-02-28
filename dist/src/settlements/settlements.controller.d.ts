import { SettlementsService } from './settlements.service';
export declare class SettlementsController {
    private settlementsService;
    constructor(settlementsService: SettlementsService);
    run(userId: string): Promise<{
        createdAt: number;
        players: {
            playerId: string;
            coin: number;
            bankDebt: number;
            net: number;
        }[];
        id: string;
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
