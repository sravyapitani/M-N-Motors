-- CreateEnum
CREATE TYPE "ValuationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleLoanStatus" AS ENUM ('UNKNOWN', 'NO_OUTSTANDING', 'OUTSTANDING', 'CLEARED');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "loanStatus" "VehicleLoanStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "make" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "nocReceived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previousOwnerCount" INTEGER,
ADD COLUMN     "variant" TEXT;

-- AlterTable
ALTER TABLE "VehicleInspection" ADD COLUMN     "accidentHistory" BOOLEAN,
ADD COLUMN     "fullServiceHistory" BOOLEAN,
ADD COLUMN     "inspectionScore" INTEGER,
ADD COLUMN     "repaintHistory" BOOLEAN;

-- CreateTable
CREATE TABLE "VehicleBasePrice" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "modelYear" INTEGER NOT NULL,
    "basePrice" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleBasePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationRule" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValuationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationRuleBand" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "bandKey" TEXT NOT NULL,
    "minValue" DECIMAL(14,2),
    "maxValue" DECIMAL(14,2),
    "ruleValue" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "conditions" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValuationRuleBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleValuation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "suggestedValue" DECIMAL(14,2) NOT NULL,
    "evaluatorQuotedValue" DECIMAL(14,2),
    "finalValue" DECIMAL(14,2),
    "status" "ValuationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculationSnapshot" JSONB,
    "evaluatorRemarks" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleValuationApproval" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleValuationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleBasePrice_make_model_modelYear_idx" ON "VehicleBasePrice"("make", "model", "modelYear");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleBasePrice_make_model_variant_modelYear_key" ON "VehicleBasePrice"("make", "model", "variant", "modelYear");

-- CreateIndex
CREATE UNIQUE INDEX "ValuationRule_ruleKey_key" ON "ValuationRule"("ruleKey");

-- CreateIndex
CREATE INDEX "ValuationRule_isActive_idx" ON "ValuationRule"("isActive");

-- CreateIndex
CREATE INDEX "ValuationRuleBand_ruleId_sortOrder_idx" ON "ValuationRuleBand"("ruleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ValuationRuleBand_ruleId_bandKey_key" ON "ValuationRuleBand"("ruleId", "bandKey");

-- CreateIndex
CREATE INDEX "VehicleValuation_vehicleId_status_idx" ON "VehicleValuation"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "VehicleValuation_createdAt_idx" ON "VehicleValuation"("createdAt");

-- CreateIndex
CREATE INDEX "VehicleValuationApproval_valuationId_decision_idx" ON "VehicleValuationApproval"("valuationId", "decision");

-- CreateIndex
CREATE INDEX "VehicleValuationApproval_createdAt_idx" ON "VehicleValuationApproval"("createdAt");

-- AddForeignKey
ALTER TABLE "ValuationRuleBand" ADD CONSTRAINT "ValuationRuleBand_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValuationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleValuation" ADD CONSTRAINT "VehicleValuation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleValuationApproval" ADD CONSTRAINT "VehicleValuationApproval_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "VehicleValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
