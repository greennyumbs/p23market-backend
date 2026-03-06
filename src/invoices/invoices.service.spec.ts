import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const now = new Date('2026-03-06T10:00:00.000Z');

  const makeService = (overrides: Record<string, unknown> = {}) => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
      ...overrides,
    };

    const service = new InvoicesService(prisma as any);
    return { service, prisma };
  };

  it('creates invoice with valid input', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.invoice.create.mockResolvedValue({ id: 'inv1' });

    await service.createInvoice('u1', {
      receiverId: 'u2',
      amount: 50,
      note: ' table A ',
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: {
        createdByUserId: 'u1',
        currentPayerUserId: 'u2',
        amount: 50,
        noteLatest: 'table A',
      },
    });
  });

  it('rejects create invoice for amount <= 0 and self receiver', async () => {
    const { service } = makeService();

    await expect(
      service.createInvoice('u1', {
        receiverId: 'u2',
        amount: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.createInvoice('u1', {
        receiverId: 'u1',
        amount: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('payer pays invoice successfully', async () => {
    const invoice = {
      id: 'inv1',
      createdByUserId: 'u2',
      currentPayerUserId: 'u4',
      amount: 50,
      status: InvoiceStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      noteLatest: 'a',
      paidAt: null,
      cancelledAt: null,
    };

    const paidInvoice = {
      ...invoice,
      status: InvoiceStatus.PAID,
      paidAt: now,
    };

    const { service, prisma } = makeService({
      $transaction: jest.fn(async (cb) => cb(prisma)),
    });

    prisma.invoice.findUnique
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce(paidInvoice);
    prisma.user.findUnique.mockResolvedValue({ coin: 60 });
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    prisma.transaction.create.mockResolvedValue({ id: 'tx1' });

    const result = await service.payInvoice('u4', 'inv1');

    expect(result.invoice.status).toBe(InvoiceStatus.PAID);
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: 'invoice:inv1',
          amount: 50,
        }),
      }),
    );
  });

  it('fails pay with INSUFFICIENT_COIN', async () => {
    const invoice = {
      id: 'inv1',
      createdByUserId: 'u2',
      currentPayerUserId: 'u4',
      amount: 50,
      status: InvoiceStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      noteLatest: 'a',
      paidAt: null,
      cancelledAt: null,
    };

    const { service, prisma } = makeService({
      $transaction: jest.fn(async (cb) => cb(prisma)),
    });

    prisma.invoice.findUnique.mockResolvedValue(invoice);
    prisma.user.findUnique.mockResolvedValue({ coin: 20 });

    await expect(service.payInvoice('u4', 'inv1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('transfers debt and changes current payer', async () => {
    const invoice = {
      id: 'inv1',
      createdByUserId: 'u2',
      currentPayerUserId: 'u4',
      amount: 50,
      status: InvoiceStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      noteLatest: 'a',
      paidAt: null,
      cancelledAt: null,
    };

    const { service, prisma } = makeService({
      $transaction: jest.fn(async (cb) => cb(prisma)),
    });

    prisma.user.findUnique.mockResolvedValue({ id: 'u9' });
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    prisma.invoice.update.mockResolvedValue({
      ...invoice,
      currentPayerUserId: 'u9',
      noteLatest: 'โอนหนี้โต๊ะ B',
    });

    const result = await service.transferInvoiceDebt('u4', 'inv1', {
      toUserId: 'u9',
      note: 'โอนหนี้โต๊ะ B',
    });

    expect(result.currentPayerUserId).toBe('u9');
  });

  it('fails transfer debt when target invalid or same as payer', async () => {
    const { service, prisma } = makeService();

    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.transferInvoiceDebt('u4', 'inv1', {
        toUserId: 'u9',
        note: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.user.findUnique.mockResolvedValue({ id: 'u4' });

    await expect(
      service.transferInvoiceDebt('u4', 'inv1', {
        toUserId: 'u4',
        note: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creator cancels pending invoice', async () => {
    const invoice = {
      id: 'inv1',
      createdByUserId: 'u2',
      currentPayerUserId: 'u4',
      amount: 50,
      status: InvoiceStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      noteLatest: 'a',
      paidAt: null,
      cancelledAt: null,
    };

    const cancelled = {
      ...invoice,
      status: InvoiceStatus.CANCELLED,
      cancelledAt: now,
    };

    const { service, prisma } = makeService({
      $transaction: jest.fn(async (cb) => cb(prisma)),
    });

    prisma.invoice.findUnique
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce(cancelled);
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.cancelInvoice('u2', 'inv1');

    expect(result.status).toBe(InvoiceStatus.CANCELLED);
  });

  it('fails cancel when requester is not creator or invoice not pending', async () => {
    const paidInvoice = {
      id: 'inv1',
      createdByUserId: 'u2',
      currentPayerUserId: 'u4',
      amount: 50,
      status: InvoiceStatus.PAID,
      createdAt: now,
      updatedAt: now,
      noteLatest: 'a',
      paidAt: now,
      cancelledAt: null,
    };

    const { service, prisma } = makeService({
      $transaction: jest.fn(async (cb) => cb(prisma)),
    });

    prisma.invoice.findUnique.mockResolvedValue(paidInvoice);

    await expect(service.cancelInvoice('u4', 'inv1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await expect(service.cancelInvoice('u2', 'inv1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns my invoices pagination for assigned/created and status filter', async () => {
    const { service, prisma } = makeService();

    prisma.invoice.findMany.mockResolvedValue([{ id: 'inv1' }]);
    prisma.invoice.count.mockResolvedValue(1);

    await service.findMyInvoices('u4', {
      tab: 'assigned',
      status: 'pending',
      page: '1',
      limit: '20',
    });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currentPayerUserId: 'u4',
          status: InvoiceStatus.PENDING,
        }),
      }),
    );

    await service.findMyInvoices('u4', {
      tab: 'created',
      status: 'all',
      page: '1',
      limit: '20',
    });

    expect(prisma.invoice.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdByUserId: 'u4',
        }),
      }),
    );
  });
});
