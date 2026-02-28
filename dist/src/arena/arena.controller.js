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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArenaController = void 0;
const common_1 = require("@nestjs/common");
const arena_service_1 = require("./arena.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const get_user_decorator_1 = require("../auth/get-user.decorator");
const swagger_1 = require("@nestjs/swagger");
const create_room_dto_1 = require("./dto/create-room.dto");
const join_room_dto_1 = require("./dto/join-room.dto");
let ArenaController = class ArenaController {
    arenaService;
    constructor(arenaService) {
        this.arenaService = arenaService;
    }
    async findAllRooms() {
        const rooms = await this.arenaService.findAllRooms();
        return {
            items: rooms.map((r) => ({
                id: r.id,
                ownerId: r.ownerId,
                ownerDisplayName: r.owner.displayName,
                ownerAvatarIndex: r.owner.avatarIndex,
                amount: r.amount,
                status: r.status.toLowerCase(),
                createdAt: Math.floor(r.createdAt.getTime() / 1000),
            })),
        };
    }
    async createRoom(userId, body) {
        const room = await this.arenaService.createRoom(userId, body.amount, body.choice);
        return {
            ok: true,
            room: {
                id: room.id,
                ownerId: room.ownerId,
                amount: room.amount,
                status: room.status.toLowerCase(),
                createdAt: Math.floor(room.createdAt.getTime() / 1000),
            },
        };
    }
    async joinRoom(userId, roomId, body) {
        const match = await this.arenaService.joinRoom(userId, roomId, body.choice);
        let outcome = 'draw';
        if (match.winnerUserId === userId)
            outcome = 'win';
        else if (match.winnerUserId && match.winnerUserId !== userId)
            outcome = 'lose';
        return {
            ok: true,
            match: {
                id: match.id,
                roomId: match.roomId,
                ownerId: match.ownerId,
                challengerId: match.challengerId,
                amount: match.amount,
                ownerChoice: match.ownerChoice,
                challengerChoice: match.challengerChoice,
                result: {
                    winnerUserId: match.winnerUserId,
                    loserUserId: match.winnerUserId
                        ? match.winnerUserId === match.ownerId
                            ? match.challengerId
                            : match.ownerId
                        : null,
                    outcome,
                },
                resolvedAt: Math.floor(match.resolvedAt.getTime() / 1000),
            },
        };
    }
    async findAllMatches() {
        const matches = await this.arenaService.findAllMatches();
        return {
            items: matches.map((m) => ({
                id: m.id,
                roomId: m.roomId,
                ownerId: m.ownerId,
                challengerId: m.challengerId,
                amount: m.amount,
                ownerChoice: m.ownerChoice,
                challengerChoice: m.challengerChoice,
                winnerUserId: m.winnerUserId,
                resolvedAt: Math.floor(m.resolvedAt.getTime() / 1000),
            })),
        };
    }
};
exports.ArenaController = ArenaController;
__decorate([
    (0, common_1.Get)('rooms'),
    (0, swagger_1.ApiOperation)({ summary: 'List open rooms for join' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ArenaController.prototype, "findAllRooms", null);
__decorate([
    (0, common_1.Post)('rooms'),
    (0, swagger_1.ApiOperation)({
        summary: 'Create room with fixed amount and hidden owner choice',
    }),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_room_dto_1.CreateRoomDto]),
    __metadata("design:returntype", Promise)
], ArenaController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Post)('rooms/:roomId/join'),
    (0, swagger_1.ApiOperation)({
        summary: 'Join room and submit challenger choice to resolve match',
    }),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Param)('roomId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, join_room_dto_1.JoinRoomDto]),
    __metadata("design:returntype", Promise)
], ArenaController.prototype, "joinRoom", null);
__decorate([
    (0, common_1.Get)('matches'),
    (0, swagger_1.ApiOperation)({ summary: 'List mini-game match history' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ArenaController.prototype, "findAllMatches", null);
exports.ArenaController = ArenaController = __decorate([
    (0, swagger_1.ApiTags)('v1/arena'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/arena'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [arena_service_1.ArenaService])
], ArenaController);
//# sourceMappingURL=arena.controller.js.map