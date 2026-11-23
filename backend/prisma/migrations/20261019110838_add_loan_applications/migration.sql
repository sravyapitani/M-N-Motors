-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ENQUIRY', 'SUBMITTED', 'UNDER_REVIEW', 'SANCTIONED', 'DISBURSED', 'REJECTED');

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "loanAmount" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" "LoanStatus" NOT NULL DEFAULT 'ENQUIRY',
    "branchId" TEXT NOT NULL,
    "submittingUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanApplication_branchId_idx" ON "LoanApplication"("branchId");

-- CreateIndex
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication"("status");

-- CreateIndex
CREATE INDEX "LoanApplication_createdAt_idx" ON "LoanApplication"("createdAt");

-- CreateIndex
CREATE INDEX "LoanApplication_branchId_status_idx" ON "LoanApplication"("branchId", "status");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_submittingUserId_fkey" FOREIGN KEY ("submittingUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
