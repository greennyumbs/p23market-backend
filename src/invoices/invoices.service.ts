import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { TransferInvoiceDto } from './dto/transfer-invoice.dto';

type MyInvoicesTab = 'assigned' | 'created';
type MyInvoicesStatus = 'all' | 'pending' | 'paid' | 'cancelled';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async createInvoice(userId: string, body: CreateInvoiceDto) {
    if (!Number.isInteger(body.amount) || body.amount <= 0) {
      this.throwValidation('amount must be integer and greater than 0');
    }

    if (body.receiverId === userId) {
      this.throwValidation('receiverId must not be current user');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: body.receiverId },
      select: { id: true },
    });

    if (!receiver) {
      this.throwValidation('receiverId must exist');
    }

    const noteLatest = body.note?.trim() ?? '';

    return this.prisma.invoice.create({
      data: {
        createdByUserId: userId,
        currentPayerUserId: body.receiverId,
        amount: body.amount,
        noteLatest,
      },
    });
  }

  async findMyInvoices(
    userId: string,
    query: {
      tab?: string;
      status?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const tab = this.parseTab(query.tab);
    const status = this.parseStatus(query.status);
    const page = this.parsePositiveInt(query.page, 1, 'page');
    const limit = this.parsePositiveInt(query.limit, 20, 'limit');

    if (limit > 100) {
      this.throwValidation('limit must be <= 100');
    }

    const where: Prisma.InvoiceWhereInput = {
      ...(tab === 'assigned'
        ? { currentPayerUserId: userId }
        : { createdByUserId: userId }),
      ...(status === 'all' ? {} : { status: this.statusToEnum(status) }),
    };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async payInvoice(userId: string, invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = this.ensureInvoiceExists(
        await tx.invoice.findUnique({ where: { id: invoiceId } }),
      );

      if (invoice.currentPayerUserId !== userId) {
        this.throwForbidden('NOT_INVOICE_PAYER', 'Caller is not invoice payer');
      }
      this.ensureInvoicePending(invoice.status);

      const payer = await tx.user.findUnique({
        where: { id: userId },
        select: { coin: true },
      });
      if (!payer || payer.coin < invoice.amount) {
        this.throwBadRequest('INSUFFICIENT_COIN', 'Insufficient coin balance');
      }

      const paidAt = new Date();
      const updatedCount = await tx.invoice.updateMany({
        where: {
          id: invoiceId,
          currentPayerUserId: userId,
          status: InvoiceStatus.PENDING,
        },
        data: {
          status: InvoiceStatus.PAID,
          paidAt,
        },
      });

      if (updatedCount.count !== 1) {
        const latest = this.ensureInvoiceExists(
          await tx.invoice.findUnique({ where: { id: invoiceId } }),
        );
        this.ensureInvoicePending(latest.status);
        this.throwConflict('INVOICE_ALREADY_PAID', 'Invoice already paid');
      }

      await tx.user.update({
        where: { id: userId },
        data: { coin: { decrement: invoice.amount } },
      });

      await tx.user.update({
        where: { id: invoice.createdByUserId },
        data: { coin: { increment: invoice.amount } },
      });

      const transfer = await tx.transaction.create({
        data: {
          type: TransactionType.TRANSFER,
          fromUserId: userId,
          toUserId: invoice.createdByUserId,
          amount: invoice.amount,
          note: `invoice:${invoice.id}`,
        },
      });

      const paidInvoice = this.ensureInvoiceExists(
        await tx.invoice.findUnique({ where: { id: invoiceId } }),
      );

      return {
        invoice: paidInvoice,
        transfer,
      };
    });
  }

  async transferInvoiceDebt(
    userId: string,
    invoiceId: string,
    body: TransferInvoiceDto,
  ) {
    const noteLatest = body.note?.trim() ?? '';
    if (!noteLatest) {
      this.throwValidation('note is required and must be non-empty');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: body.toUserId },
      select: { id: true },
    });

    if (!target || body.toUserId === userId) {
      this.throwBadRequest(
        'INVALID_TRANSFER_TARGET',
        'Transfer target is invalid',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = this.ensureInvoiceExists(
        await tx.invoice.findUnique({ where: { id: invoiceId } }),
      );

      if (invoice.currentPayerUserId !== userId) {
        this.throwForbidden('NOT_INVOICE_PAYER', 'Caller is not invoice payer');
      }

      this.ensureInvoicePending(invoice.status);

      if (body.toUserId === invoice.currentPayerUserId) {
        this.throwBadRequest(
          'INVALID_TRANSFER_TARGET',
          'Transfer target is invalid',
        );
      }

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          currentPayerUserId: body.toUserId,
          noteLatest,
        },
      });
    });
  }

  async cancelInvoice(userId: string, invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = this.ensureInvoiceExists(
        await tx.invoice.findUnique({ where: { id: invoiceId } }),
      );

      if (invoice.createdByUserId !== userId) {
        this.throwForbidden(
          'NOT_INVOICE_CREATOR',
          'Caller is not invoice creator',
        );
      }

      this.ensureInvoicePending(invoice.status);

      const cancelledAt = new Date();
      const updatedCount = await tx.invoice.updateMany({
        where: { id: invoiceId, status: InvoiceStatus.PENDING },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt,
        },
      });

      if (updatedCount.count !== 1) {
        const latest = this.ensureInvoiceExists(
          await tx.invoice.findUnique({ where: { id: invoiceId } }),
        );
        this.ensureInvoicePending(latest.status);
        this.throwConflict('INVOICE_CANCELLED', 'Invoice cancelled');
      }

      const cancelledInvoice = this.ensureInvoiceExists(
        await tx.invoice.findUnique({
          where: { id: invoiceId },
        }),
      );
      return cancelledInvoice;
    });
  }

  private parseTab(raw?: string): MyInvoicesTab {
    if (!raw) return 'assigned';
    if (raw === 'assigned' || raw === 'created') return raw;
    this.throwValidation('tab must be assigned or created');
  }

  private parseStatus(raw?: string): MyInvoicesStatus {
    if (!raw) return 'all';
    if (raw === 'all' || raw === 'pending' || raw === 'paid' || raw === 'cancelled') {
      return raw;
    }
    this.throwValidation('status must be all, pending, paid, or cancelled');
  }

  private parsePositiveInt(raw: string | undefined, fallback: number, field: string) {
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      this.throwValidation(`${field} must be positive integer`);
    }
    return parsed;
  }

  private statusToEnum(status: Exclude<MyInvoicesStatus, 'all'>): InvoiceStatus {
    if (status === 'pending') return InvoiceStatus.PENDING;
    if (status === 'paid') return InvoiceStatus.PAID;
    return InvoiceStatus.CANCELLED;
  }

  private ensureInvoiceExists<T extends { id: string }>(invoice: T | null): T {
    if (!invoice) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
      });
    }
    return invoice;
  }

  private ensureInvoicePending(status: InvoiceStatus) {
    if (status === InvoiceStatus.PAID) {
      this.throwConflict('INVOICE_ALREADY_PAID', 'Invoice already paid');
    }
    if (status === InvoiceStatus.CANCELLED) {
      this.throwConflict('INVOICE_CANCELLED', 'Invoice cancelled');
    }
  }

  private throwValidation(message: string): never {
    this.throwBadRequest('VALIDATION_ERROR', message);
  }

  private throwBadRequest(code: string, message: string): never {
    throw new BadRequestException({ code, message });
  }

  private throwForbidden(code: string, message: string): never {
    throw new ForbiddenException({ code, message });
  }

  private throwConflict(code: string, message: string): never {
    throw new ConflictException({ code, message });
  }
}
