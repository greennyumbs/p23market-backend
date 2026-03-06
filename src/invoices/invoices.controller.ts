import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { TransferInvoiceDto } from './dto/transfer-invoice.dto';

@ApiTags('v1/invoices')
@ApiBearerAuth()
@Controller('api/v1')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Post('invoices')
  @ApiOperation({ summary: 'Create invoice' })
  async createInvoice(@GetUser('id') userId: string, @Body() body: CreateInvoiceDto) {
    const invoice = await this.invoicesService.createInvoice(userId, body);
    return {
      ok: true,
      invoice: this.serializeInvoice(invoice),
    };
  }

  @Get('invoices/my')
  @ApiOperation({ summary: 'My invoices list for assigned or created tabs' })
  async findMyInvoices(
    @GetUser('id') userId: string,
    @Query('tab') tab?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.invoicesService.findMyInvoices(userId, {
      tab,
      status,
      page,
      limit,
    });

    return {
      items: result.items.map((invoice) => this.serializeInvoice(invoice)),
      pagination: result.pagination,
    };
  }

  @Post('invoices/:invoiceId/pay')
  @ApiOperation({ summary: 'Pay full invoice amount' })
  async payInvoice(
    @GetUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const { invoice, transfer } = await this.invoicesService.payInvoice(
      userId,
      invoiceId,
    );

    return {
      ok: true,
      invoice: {
        id: invoice.id,
        status: this.serializeStatus(invoice.status),
        paidAt: this.toUnix(invoice.paidAt),
        updatedAt: this.toUnix(invoice.updatedAt),
      },
      transfer: {
        id: transfer.id,
        type: 'transfer',
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        amount: transfer.amount,
        note: transfer.note,
        createdAt: this.toUnix(transfer.createdAt),
      },
    };
  }

  @Post('invoices/:invoiceId/transfer')
  @ApiOperation({ summary: 'Transfer invoice debt to another payer' })
  async transferDebt(
    @GetUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: TransferInvoiceDto,
  ) {
    const invoice = await this.invoicesService.transferInvoiceDebt(
      userId,
      invoiceId,
      body,
    );

    return {
      ok: true,
      invoice: this.serializeInvoice(invoice),
    };
  }

  @Post('invoices/:invoiceId/cancel')
  @ApiOperation({ summary: 'Cancel pending invoice' })
  async cancelInvoice(
    @GetUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const invoice = await this.invoicesService.cancelInvoice(userId, invoiceId);
    return {
      ok: true,
      invoice: {
        id: invoice.id,
        status: this.serializeStatus(invoice.status),
        cancelledAt: this.toUnix(invoice.cancelledAt),
        updatedAt: this.toUnix(invoice.updatedAt),
      },
    };
  }

  private serializeInvoice(invoice: {
    id: string;
    createdByUserId: string;
    currentPayerUserId: string;
    amount: number;
    noteLatest: string;
    status: InvoiceStatus;
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date | null;
    cancelledAt: Date | null;
  }) {
    return {
      id: invoice.id,
      createdByUserId: invoice.createdByUserId,
      currentPayerUserId: invoice.currentPayerUserId,
      amount: invoice.amount,
      noteLatest: invoice.noteLatest,
      status: this.serializeStatus(invoice.status),
      createdAt: this.toUnix(invoice.createdAt),
      updatedAt: this.toUnix(invoice.updatedAt),
      paidAt: this.toUnix(invoice.paidAt),
      cancelledAt: this.toUnix(invoice.cancelledAt),
    };
  }

  private serializeStatus(status: InvoiceStatus) {
    return status.toLowerCase();
  }

  private toUnix(date: Date | null) {
    if (!date) return null;
    return Math.floor(date.getTime() / 1000);
  }
}
