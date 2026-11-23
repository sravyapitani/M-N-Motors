/*
  Warnings:

  - A unique constraint covering the columns `[vehicleId,documentType,version]` on the table `VehicleDocument` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "VehicleDocument_vehicleId_idx";

-- AlterTable
ALTER TABLE "RcBookVerification" ADD COLUMN     "documentSnapshot" JSONB,
ADD COLUMN     "isOutdated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VehicleDocument" ADD COLUMN     "fileHash" TEXT,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "replacedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "VehicleDocument_vehicleId_isCurrent_idx" ON "VehicleDocument"("vehicleId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleDocument_vehicleId_documentType_version_key" ON "VehicleDocument"("vehicleId", "documentType", "version");
