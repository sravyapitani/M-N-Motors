-- CreateEnum
CREATE TYPE "VehicleFuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'EV');

-- CreateEnum
CREATE TYPE "VehicleSegment" AS ENUM ('PASSENGER', 'COMMERCIAL', 'THREE_WHEELER');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "fuelType" "VehicleFuelType",
ADD COLUMN     "vehicleSegment" "VehicleSegment";
