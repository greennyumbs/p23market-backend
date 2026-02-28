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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const swagger_1 = require("@nestjs/swagger");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async findAll() {
        const items = await this.usersService.findAll();
        return { items: items.map((u) => ({ ...u, net: u.coin - u.bankDebt })) };
    }
    async findOne(id) {
        const user = await this.usersService.findById(id);
        if (!user)
            return null;
        const { passwordHash, ...result } = user;
        return { ...result, net: user.coin - user.bankDebt };
    }
    async getLeaderboard() {
        const users = await this.usersService.findAll();
        const ranked = users
            .map((u) => ({
            playerId: u.id,
            displayName: u.displayName,
            coin: u.coin,
            bankDebt: u.bankDebt,
            net: u.coin - u.bankDebt,
        }))
            .sort((a, b) => b.net - a.net)
            .map((u, index) => ({ rank: index + 1, ...u }));
        return { items: ranked };
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('players'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('players/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('leaderboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getLeaderboard", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('v1/players'),
    (0, common_1.Controller)('api/v1'),
    (0, common_1.UseInterceptors)(common_1.ClassSerializerInterceptor),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map