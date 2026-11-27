-- CreateEnum
CREATE TYPE "FundingFacilityType" AS ENUM ('CC', 'INVENTORY', 'OTHER');

-- CreateTable
CREATE TABLE "FundingFacility" (
    "id" TEXT NOT NULL,
    "facilityKey" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "facilityType" "FundingFacilityType" NOT NULL DEFAULT 'INVENTORY',
    "sanctionedLimit" DECIMAL(16,2) NOT NULL,
    "roiPercent" DECIMAL(5,2),
    "graceDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lenderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingDraw" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "drawDate" DATE NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "branchId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingRepayment" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingDrawHistory" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingDrawHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingFacility_facilityKey_key" ON "FundingFacility"("facilityKey");

-- CreateIndex
CREATE INDEX "FundingFacility_bankName_idx" ON "FundingFacility"("bankName");

-- CreateIndex
CREATE INDEX "FundingFacility_isActive_idx" ON "FundingFacility"("isActive");

-- CreateIndex
CREATE INDEX "FundingDraw_facilityId_idx" ON "FundingDraw"("facilityId");

-- CreateIndex
CREATE INDEX "FundingDraw_drawDate_idx" ON "FundingDraw"("drawDate");

-- CreateIndex
CREATE INDEX "FundingDraw_createdById_idx" ON "FundingDraw"("createdById");

-- CreateIndex
CREATE INDEX "FundingDraw_branchId_idx" ON "FundingDraw"("branchId");

-- CreateIndex
CREATE INDEX "FundingRepayment_drawId_idx" ON "FundingRepayment"("drawId");

-- CreateIndex
CREATE INDEX "FundingRepayment_paymentDate_idx" ON "FundingRepayment"("paymentDate");

-- CreateIndex
CREATE INDEX "FundingRepayment_createdById_idx" ON "FundingRepayment"("createdById");

-- CreateIndex
CREATE INDEX "FundingDrawHistory_drawId_idx" ON "FundingDrawHistory"("drawId");

-- CreateIndex
CREATE INDEX "FundingDrawHistory_createdAt_idx" ON "FundingDrawHistory"("createdAt");

-- CreateIndex
CREATE INDEX "FundingDrawHistory_userId_idx" ON "FundingDrawHistory"("userId");

-- AddForeignKey
ALTER TABLE "FundingFacility" ADD CONSTRAINT "FundingFacility_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "Lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDraw" ADD CONSTRAINT "FundingDraw_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "FundingFacility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDraw" ADD CONSTRAINT "FundingDraw_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDraw" ADD CONSTRAINT "FundingDraw_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingRepayment" ADD CONSTRAINT "FundingRepayment_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "FundingDraw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingRepayment" ADD CONSTRAINT "FundingRepayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDrawHistory" ADD CONSTRAINT "FundingDrawHistory_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "FundingDraw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDrawHistory" ADD CONSTRAINT "FundingDrawHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
