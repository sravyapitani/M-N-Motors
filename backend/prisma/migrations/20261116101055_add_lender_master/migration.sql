-- CreateEnum
CREATE TYPE "LenderType" AS ENUM ('BANK', 'NBFC', 'INSURANCE', 'OTHER');

-- AlterTable
ALTER TABLE "LoanApplication" ADD COLUMN     "lenderId" TEXT;

-- CreateTable
CREATE TABLE "Lender" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tallyLedgerName" TEXT NOT NULL,
    "type" "LenderType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lender_tallyLedgerName_key" ON "Lender"("tallyLedgerName");

-- CreateIndex
CREATE INDEX "Lender_type_idx" ON "Lender"("type");

-- CreateIndex
CREATE INDEX "Lender_isActive_idx" ON "Lender"("isActive");

-- CreateIndex
CREATE INDEX "LoanApplication_lenderId_idx" ON "LoanApplication"("lenderId");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "Lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
