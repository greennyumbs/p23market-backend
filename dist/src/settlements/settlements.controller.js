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
exports.SettlementsController = void 0;
const common_1 = require("@nestjs/common");
const settlements_service_1 = require("./settlements.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const get_user_decorator_1 = require("../auth/get-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let SettlementsController = class SettlementsController {
    settlementsService;
    constructor(settlementsService) {
        this.settlementsService = settlementsService;
    }
    async run(userId) {
        const result = await this.settlementsService.run(userId);
        return {
            ...result,
            createdAt: Math.floor(result.createdAt.getTime() / 1000),
            players: result.players.map((p) => ({
                playerId: p.userId,
                coin: p.coin,
                bankDebt: p.bankDebt,
                net: p.net,
            })),
        };
    }
    async findAll() {
        return this.settlementsService.findAll();
    }
};
exports.SettlementsController = SettlementsController;
__decorate([
    (0, common_1.Post)('run'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettlementsController.prototype, "run", null);
__decorate([
    (0, common_1.Get)('runs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettlementsController.prototype, "findAll", null);
exports.SettlementsController = SettlementsController = __decorate([
    (0, swagger_1.ApiTags)('v1/settlement'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/settlement'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.UseInterceptors)(common_1.ClassSerializerInterceptor),
    __metadata("design:paramtypes", [settlements_service_1.SettlementsService])
], SettlementsController);
//# sourceMappingURL=settlements.controller.js.map