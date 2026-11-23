-- CreateEnum
CREATE TYPE "RcBookAssessmentStatus" AS ENUM ('CLEAR', 'MANUAL_REVIEW', 'BLOCKED');

-- AlterTable
ALTER TABLE "RcBookVerification" ADD COLUMN     "assessmentStatus" "RcBookAssessmentStatus" NOT NULL DEFAULT 'MANUAL_REVIEW',
ADD COLUMN     "authenticityStatus" TEXT NOT NULL DEFAULT 'NOT_INDEPENDENTLY_VERIFIED';
