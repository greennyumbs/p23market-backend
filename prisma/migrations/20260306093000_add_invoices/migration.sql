-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "currentPayerUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "noteLatest" TEXT NOT NULL DEFAULT '',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_createdByUserId_idx" ON "invoices"("createdByUserId");

-- CreateIndex
CREATE INDEX "invoices_currentPayerUserId_idx" ON "invoices"("currentPayerUserId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_updatedAt_idx" ON "invoices"("updatedAt");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currentPayerUserId_fkey" FOREIGN KEY ("currentPayerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
