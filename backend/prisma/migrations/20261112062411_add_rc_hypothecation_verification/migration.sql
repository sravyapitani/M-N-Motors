-- CreateEnum
CREATE TYPE "HypothecationStatus" AS ENUM ('UNKNOWN', 'NOT_HYPOTHECATED', 'HYPOTHECATED');

-- CreateEnum
CREATE TYPE "NocVerificationStatus" AS ENUM ('NOT_RECEIVED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HypothecationTerminationStatus" AS ENUM ('UNKNOWN', 'NOT_APPLICABLE', 'PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "colour" TEXT,
ADD COLUMN     "financierName" TEXT,
ADD COLUMN     "hypothecationRemarks" TEXT,
ADD COLUMN     "hypothecationStatus" "HypothecationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "hypothecationTerminationStatus" "HypothecationTerminationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "loanAccountReference" TEXT,
ADD COLUMN     "nocVerificationStatus" "NocVerificationStatus" NOT NULL DEFAULT 'NOT_RECEIVED';
