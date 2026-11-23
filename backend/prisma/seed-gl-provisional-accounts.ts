/**
 * ============================================================================
 * PROVISIONAL CHART OF ACCOUNTS SEED SCRIPT
 * ============================================================================
 * IMPORTANT / CAUTION:
 * The account codes ('1150', '4300') and names in this file are strictly
 * PROVISIONAL engineering placeholders. The dealership currently maintains its
 * official Chart of Accounts in Tally ERP without numeric codes.
 *
 * These accounts MUST be renamed, re-coded, or mapped to official Tally ledger
 * names once confirmed and approved by the Finance Controller / Accounting team.
 * ============================================================================
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountType } from '../src/generated/prisma/enums';

async function main() {
  const prisma = new PrismaService();

  try {
    await prisma.$connect();
    console.log('Connected to database. Seeding provisional General Ledger accounts...');

    // 1. Provisional Lender Commission Receivable (Debit on loan disbursement)
    const receivableAccount = await prisma.account.upsert({
      where: { code: '1150' },
      update: {
        name: 'PROVISIONAL - Lender Commission Receivable',
        type: AccountType.ASSET,
        description:
          'PROVISIONAL: Control account for lender commission payouts receivable. Awaiting official Tally ledger name from Finance.',
        isActive: true,
        branchId: null,
      },
      create: {
        code: '1150',
        name: 'PROVISIONAL - Lender Commission Receivable',
        type: AccountType.ASSET,
        description:
          'PROVISIONAL: Control account for lender commission payouts receivable. Awaiting official Tally ledger name from Finance.',
        isActive: true,
        branchId: null,
      },
    });
    console.log(
      `Provisional Account Ensured: ${receivableAccount.code} — ${receivableAccount.name} (${receivableAccount.id})`,
    );

    // 2. Provisional F&I Commission Revenue (Credit on loan disbursement)
    const revenueAccount = await prisma.account.upsert({
      where: { code: '4300' },
      update: {
        name: 'PROVISIONAL - F&I Commission Revenue',
        type: AccountType.REVENUE,
        description:
          'PROVISIONAL: Dealership finance commission income recognized upon lender disbursement. Awaiting official Tally ledger name from Finance.',
        isActive: true,
        branchId: null,
      },
      create: {
        code: '4300',
        name: 'PROVISIONAL - F&I Commission Revenue',
        type: AccountType.REVENUE,
        description:
          'PROVISIONAL: Dealership finance commission income recognized upon lender disbursement. Awaiting official Tally ledger name from Finance.',
        isActive: true,
        branchId: null,
      },
    });
    console.log(
      `Provisional Account Ensured: ${revenueAccount.code} — ${revenueAccount.name} (${revenueAccount.id})`,
    );

    console.log('Successfully seeded provisional General Ledger accounts.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Error seeding provisional accounts:', error);
  process.exitCode = 1;
});

