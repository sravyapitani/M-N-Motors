-- CreateEnum
CREATE TYPE "RcBookRiskVerdict" AS ENUM ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK');

-- CreateEnum
CREATE TYPE "RcBookReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_RESUBMISSION');

-- CreateTable
CREATE TABLE "RcBookVerification" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "extractedFields" JSONB,
    "checkResults" JSONB,
    "riskFlags" JSONB,
    "riskScore" INTEGER,
    "riskVerdict" "RcBookRiskVerdict",
    "reviewStatus" "RcBookReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerName" TEXT,
    "reviewRemarks" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcBookVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcBookRule" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcBookRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RcBookVerification_vehicleId_createdAt_idx" ON "RcBookVerification"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "RcBookVerification_riskVerdict_reviewStatus_idx" ON "RcBookVerification"("riskVerdict", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RcBookRule_ruleKey_key" ON "RcBookRule"("ruleKey");

-- CreateIndex
CREATE INDEX "RcBookRule_isActive_category_idx" ON "RcBookRule"("isActive", "category");

-- AddForeignKey
ALTER TABLE "RcBookVerification" ADD CONSTRAINT "RcBookVerification_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
