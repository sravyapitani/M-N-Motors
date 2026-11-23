-- CreateEnum
CREATE TYPE "VehicleStage" AS ENUM ('INTAKE', 'INSPECTION', 'VALUATION', 'APPROVAL', 'PURCHASED', 'REFURBISHMENT', 'LISTED', 'RESOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RcBookStatus" AS ENUM ('NOT_SCANNED', 'NEEDS_VERIFICATION', 'GENUINE', 'HIGH_RISK');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "vehicleName" TEXT NOT NULL,
    "modelYear" INTEGER,
    "registrationNumber" TEXT,
    "chassisNumber" TEXT,
    "engineNumber" TEXT,
    "odometerKm" INTEGER NOT NULL,
    "score" INTEGER,
    "aiValuation" DECIMAL(14,2),
    "rcBookStatus" "RcBookStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "stage" "VehicleStage" NOT NULL DEFAULT 'INTAKE',
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chassisNumber_key" ON "Vehicle"("chassisNumber");

-- CreateIndex
CREATE INDEX "Vehicle_branchId_stage_idx" ON "Vehicle"("branchId", "stage");

-- CreateIndex
CREATE INDEX "Vehicle_customerName_idx" ON "Vehicle"("customerName");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
