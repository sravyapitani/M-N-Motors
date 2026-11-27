import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';
import { LoanStatus, PayoutKind } from '../src/generated/prisma/enums';
import {
  LOAN_AMOUNT_PAYOUT_DAYS,
  COMMISSION_PAYOUT_DAYS,
  computeExpectedDate,
} from '../src/modules/finance-loan/payout-calculator';

// PROVISIONAL: confirm with Sir
export const PAYOUT_TRACKING_START_DATE = new Date('2026-11-01T00:00:00Z');

/**
 * Idempotent backfill script to create missing LoanPayout records for already-DISBURSED loans
 * disbursed on or after PAYOUT_TRACKING_START_DATE.
 * DO NOT run automatically.
 * Run with: npx ts-node prisma/backfill-disbursed-payouts.ts
 */
async function main() {
  const prisma = new PrismaService();

  try {
    await prisma.$connect();
    console.log(`Connected to database. Checking for disbursed loans on or after ${PAYOUT_TRACKING_START_DATE.toISOString()}...`);

    const disbursedLoans = await prisma.loanApplication.findMany({
      where: {
        status: LoanStatus.DISBURSED,
        OR: [
          { disbursedAt: { gte: PAYOUT_TRACKING_START_DATE } },
          { disbursedAt: null, createdAt: { gte: PAYOUT_TRACKING_START_DATE } },
        ],
      },
      include: {
        lender: true,
        branch: true,
        payouts: true,
      },
    });

    console.log(`Found ${disbursedLoans.length} disbursed loans eligible for backfill.`);

    const countsByBranch: Record<string, { branchName: string; LOAN_AMOUNT: number; COMMISSION: number }> = {};

    for (const loan of disbursedLoans) {
      const bId = loan.branchId || 'unassigned';
      const bName = loan.branch?.name || 'Unknown Branch';
      if (!countsByBranch[bId]) {
        countsByBranch[bId] = { branchName: bName, LOAN_AMOUNT: 0, COMMISSION: 0 };
      }

      let startDate: Date;
      let dateEstimated = false;

      if (loan.disbursedAt) {
        startDate = new Date(loan.disbursedAt);
      } else if (loan.sanctionedAt) {
        startDate = new Date(loan.sanctionedAt);
        dateEstimated = true;
      } else {
        startDate = new Date(loan.createdAt);
        dateEstimated = true;
      }

      const existingKinds = new Set(loan.payouts?.map((p) => p.kind) || []);

      // 1. DO amount (LOAN_AMOUNT)
      if (!existingKinds.has(PayoutKind.LOAN_AMOUNT)) {
        const expectedDate = computeExpectedDate(startDate, 'LOAN_AMOUNT', loan.lender);
        try {
          await prisma.loanPayout.create({
            data: {
              loanId: loan.id,
              kind: PayoutKind.LOAN_AMOUNT,
              expectedAmount: loan.loanAmount,
              expectedDate,
              dateEstimated,
            },
          });
          countsByBranch[bId].LOAN_AMOUNT++;
          console.log(`Created LOAN_AMOUNT payout for loan ${loan.id} (${loan.customerName}) - ₹${loan.loanAmount}`);
        } catch (err: any) {
          if (err.code !== 'P2002') {
            console.error(`Failed to create LOAN_AMOUNT payout for loan ${loan.id}:`, err);
          }
        }
      }

      // 2. Commission (COMMISSION) - create only when commissionAmount > 0
      const commissionNum = Number(loan.commissionAmount);
      if (commissionNum > 0 && !existingKinds.has(PayoutKind.COMMISSION)) {
        const expectedDate = computeExpectedDate(startDate, 'COMMISSION', loan.lender);
        try {
          await prisma.loanPayout.create({
            data: {
              loanId: loan.id,
              kind: PayoutKind.COMMISSION,
              expectedAmount: loan.commissionAmount,
              expectedDate,
              dateEstimated,
            },
          });
          countsByBranch[bId].COMMISSION++;
          console.log(`Created COMMISSION payout for loan ${loan.id} (${loan.customerName}) - ₹${loan.commissionAmount}`);
        } catch (err: any) {
          if (err.code !== 'P2002') {
            console.error(`Failed to create COMMISSION payout for loan ${loan.id}:`, err);
          }
        }
      }
    }

    console.log('\n--- Backfill Summary by Branch and Kind ---');
    for (const [bId, c] of Object.entries(countsByBranch)) {
      console.log(`Branch: ${c.branchName} (${bId}) -> LOAN_AMOUNT: ${c.LOAN_AMOUNT}, COMMISSION: ${c.COMMISSION}`);
    }
    console.log('-------------------------------------------\n');
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
