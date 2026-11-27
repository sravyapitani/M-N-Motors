-- AlterTable
ALTER TABLE "Lender" ADD COLUMN     "payoutDays" INTEGER;

-- CreateTable
CREATE TABLE "LoanPayout" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "expectedDate" TIMESTAMP(3) NOT NULL,
    "dateEstimated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayoutReceipt" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "receivedInto" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanPayoutReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayoutHistory" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanPayoutHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanPayout_loanId_key" ON "LoanPayout"("loanId");

-- CreateIndex
CREATE INDEX "LoanPayout_expectedDate_idx" ON "LoanPayout"("expectedDate");

-- CreateIndex
CREATE INDEX "LoanPayoutReceipt_payoutId_idx" ON "LoanPayoutReceipt"("payoutId");

-- CreateIndex
CREATE INDEX "LoanPayoutReceipt_receivedDate_idx" ON "LoanPayoutReceipt"("receivedDate");

-- CreateIndex
CREATE INDEX "LoanPayoutReceipt_createdById_idx" ON "LoanPayoutReceipt"("createdById");

-- CreateIndex
CREATE INDEX "LoanPayoutHistory_payoutId_idx" ON "LoanPayoutHistory"("payoutId");

-- CreateIndex
CREATE INDEX "LoanPayoutHistory_createdAt_idx" ON "LoanPayoutHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "LoanPayout" ADD CONSTRAINT "LoanPayout_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayoutReceipt" ADD CONSTRAINT "LoanPayoutReceipt_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "LoanPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayoutReceipt" ADD CONSTRAINT "LoanPayoutReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayoutHistory" ADD CONSTRAINT "LoanPayoutHistory_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "LoanPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayoutHistory" ADD CONSTRAINT "LoanPayoutHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
