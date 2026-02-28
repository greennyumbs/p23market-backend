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
exports.TransactionsController = void 0;
const common_1 = require("@nestjs/common");
const transactions_service_1 = require("./transactions.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const get_user_decorator_1 = require("../auth/get-user.decorator");
const client_1 = require("@prisma/client");
const swagger_1 = require("@nestjs/swagger");
const transfer_dto_1 = require("./dto/transfer.dto");
const bank_operation_dto_1 = require("./dto/bank-operation.dto");
let TransactionsController = class TransactionsController {
    transactionsService;
    constructor(transactionsService) {
        this.transactionsService = transactionsService;
    }
    async transfer(userId, body) {
        const transaction = await this.transactionsService.transfer(userId, body.receiverId, body.amount, body.note);
        return { ok: true, transaction };
    }
    async borrow(userId, body) {
        const { transaction, user } = await this.transactionsService.borrow(userId, body.amount, body.note);
        return {
            ok: true,
            coin: user.coin,
            bankDebt: user.bankDebt,
            transactionId: transaction.id,
        };
    }
    async repay(userId, body) {
        const { transaction, user } = await this.transactionsService.repay(userId, body.amount, body.note);
        return {
            ok: true,
            coin: user.coin,
            bankDebt: user.bankDebt,
            transactionId: transaction.id,
        };
    }
    getBankMe(user) {
        return {
            coin: user.coin,
            bankDebt: user.bankDebt,
            net: user.coin - user.bankDebt,
            exchangeRate: 10,
        };
    }
    async findAll(type, playerId, from, to, page, limit) {
        const result = await this.transactionsService.findAll({
            type,
            playerId,
            from: from ? parseInt(from) : undefined,
            to: to ? parseInt(to) : undefined,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        });
        return {
            ...result,
            items: result.items.map((item) => ({
                ...item,
                createdAt: Math.floor(item.createdAt.getTime() / 1000),
            })),
        };
    }
};
exports.TransactionsController = TransactionsController;
__decorate([
    (0, common_1.Post)('transfers'),
    (0, swagger_1.ApiOperation)({ summary: 'Create transfer from current user to receiver' }),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, transfer_dto_1.TransferDto]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "transfer", null);
__decorate([
    (0, common_1.Post)('bank/borrow'),
    (0, swagger_1.ApiOperation)({ summary: 'Borrow from bank' }),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bank_operation_dto_1.BankOperationDto]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "borrow", null);
__decorate([
    (0, common_1.Post)('bank/repay'),
    (0, swagger_1.ApiOperation)({ summary: 'Repay bank debt' }),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bank_operation_dto_1.BankOperationDto]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "repay", null);
__decorate([
    (0, common_1.Get)('bank/me'),
    (0, swagger_1.ApiOperation)({ summary: 'Return current bank summary' }),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TransactionsController.prototype, "getBankMe", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, swagger_1.ApiOperation)({ summary: 'Public ledger records' }),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Query)('playerId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findAll", null);
exports.TransactionsController = TransactionsController = __decorate([
    (0, swagger_1.ApiTags)('v1/transactions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)(common_1.ClassSerializerInterceptor),
    __metadata("design:paramtypes", [transactions_service_1.TransactionsService])
], TransactionsController);
//# sourceMappingURL=transactions.controller.js.map