-- CreateEnum
CREATE TYPE "PayoutKind" AS ENUM ('LOAN_AMOUNT', 'COMMISSION');

-- AlterTable
ALTER TABLE "Lender" ADD COLUMN "commissionPayoutDays" INTEGER;

-- AlterTable
ALTER TABLE "LoanPayout" ADD COLUMN "kind" "PayoutKind" NOT NULL DEFAULT 'COMMISSION';

-- AlterTable
ALTER TABLE "LoanPayout" ALTER COLUMN "kind" DROP DEFAULT;

-- DropIndex
DROP INDEX "LoanPayout_loanId_key";

-- CreateIndex
CREATE UNIQUE INDEX "LoanPayout_loanId_kind_key" ON "LoanPayout"("loanId", "kind");

-- CreateIndex
CREATE INDEX "LoanPayout_kind_idx" ON "LoanPayout"("kind");
