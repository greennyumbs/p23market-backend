import { ArenaService } from './arena.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
export declare class ArenaController {
    private arenaService;
    constructor(arenaService: ArenaService);
    findAllRooms(): Promise<{
        items: {
            id: string;
            ownerId: string;
            ownerDisplayName: string;
            ownerAvatarIndex: number;
            amount: number;
            status: string;
            createdAt: number;
        }[];
    }>;
    createRoom(userId: string, body: CreateRoomDto): Promise<{
        ok: boolean;
        room: {
            id: string;
            ownerId: string;
            amount: number;
            status: string;
            createdAt: number;
        };
    }>;
    joinRoom(userId: string, roomId: string, body: JoinRoomDto): Promise<{
        ok: boolean;
        match: {
            id: string;
            roomId: string;
            ownerId: string;
            challengerId: string;
            amount: number;
            ownerChoice: string;
            challengerChoice: string;
            result: {
                winnerUserId: string | null;
                loserUserId: string | null;
                outcome: "win" | "lose" | "draw";
            };
            resolvedAt: number;
        };
    }>;
    findAllMatches(): Promise<{
        items: {
            id: string;
            roomId: string;
            ownerId: string;
            challengerId: string;
            amount: number;
            ownerChoice: string;
            challengerChoice: string;
            winnerUserId: string | null;
            resolvedAt: number;
        }[];
    }>;
}
