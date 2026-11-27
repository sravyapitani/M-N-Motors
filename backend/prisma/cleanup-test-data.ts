import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Cleanup script for orphaned integration test data and unconfirmed auto-synced payouts.
 * 
 * Safety invariants:
 * - Dry-run by default (prints counts and details without modifying database).
 * - Only modifies database when explicit '--confirm' CLI argument is passed.
 * - Entire cleanup runs inside a single atomic $transaction.
 * - Verifies baseline real entity counts before committing (11 loans, 5 branches, 13 users, 36 lenders).
 * - Never deletes GL journal rows; lists them separately for review with Akash.
 * 
 * Usage:
 * Dry-run:  npx ts-node prisma/cleanup-test-data.ts
 * Execute:  npx ts-node prisma/cleanup-test-data.ts --confirm
 */
async function main() {
  const isConfirm = process.argv.includes('--confirm');
  const prisma = new PrismaService();

  try {
    await prisma.$connect();
    console.log('Connected to database at localhost:5433.\n');

    // -------------------------------------------------------------------------
    // 1. SCAN AND GROUP DATA (READ ONLY SCAN)
    // -------------------------------------------------------------------------

    // A. Test Loans (matching literal 'RBAC_' or 'GLINT_')
    const testLoans = await prisma.loanApplication.findMany({
      where: {
        OR: [
          { customerName: { startsWith: 'RBAC_' } },
          { customerName: { startsWith: 'GLINT_' } },
        ],
      },
      select: { id: true, customerName: true, branchId: true },
    });
    const testLoanIds = testLoans.map((l) => l.id);

    // B. Test Payouts (belonging to test loans)
    const testPayouts = await prisma.loanPayout.findMany({
      where: { loanId: { in: testLoanIds } },
      select: { id: true, loanId: true, kind: true },
    });
    const testPayoutIds = testPayouts.map((p) => p.id);

    const testPayoutReceipts = await prisma.loanPayoutReceipt.findMany({
      where: { payoutId: { in: testPayoutIds } },
      select: { id: true },
    });

    const testPayoutHistory = await prisma.loanPayoutHistory.findMany({
      where: { payoutId: { in: testPayoutIds } },
      select: { id: true },
    });

    // C. Test Users & Links
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { startsWith: 'RBAC_' } },
          { email: { startsWith: 'GLINT_' } },
        ],
      },
      select: { id: true, email: true },
    });
    const testUserIds = testUsers.map((u) => u.id);

    // D. Test Branches
    const testBranches = await prisma.branch.findMany({
      where: {
        OR: [
          { code: { startsWith: 'RBAC_' } },
          { code: { startsWith: 'GLINT_' } },
        ],
      },
      select: { id: true, code: true, name: true },
    });
    const testBranchIds = testBranches.map((b) => b.id);

    const testUserBranches = await prisma.userBranch.findMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { branchId: { in: testBranchIds } },
        ],
      },
      select: { userId: true, branchId: true },
    });

    const testUserRoles = await prisma.userRole.findMany({
      where: { userId: { in: testUserIds } },
      select: { userId: true, roleId: true },
    });

    // E. Real Loans Payouts (Group 2: Created by the removed sync on the 11 real loans)
    const realLoansPayouts = await prisma.loanPayout.findMany({
      where: {
        NOT: {
          loan: {
            OR: [
              { customerName: { startsWith: 'RBAC_' } },
              { customerName: { startsWith: 'GLINT_' } },
            ],
          },
        },
      },
      include: {
        loan: { select: { id: true, customerName: true } },
        receipts: true,
        history: true,
      },
    });

    // Check invariant: real loan payouts must have 0 receipts and 0 history
    for (const p of realLoansPayouts) {
      if (p.receipts.length > 0) {
        throw new Error(
          `ABORT: Real loan payout '${p.id}' (${p.loan.customerName}) has ${p.receipts.length} receipt(s). Cannot delete!`,
        );
      }
      if (p.history.length > 0) {
        throw new Error(
          `ABORT: Real loan payout '${p.id}' (${p.loan.customerName}) has ${p.history.length} history row(s). Cannot delete!`,
        );
      }
    }

    // F. GL Journal Entries Check (Group 3: Finance & Accounting Data Review)
    const glTestEntries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          { sourceReference: { startsWith: 'RBAC_' } },
          { sourceReference: { startsWith: 'GLINT_' } },
          { sourceReference: { in: testLoanIds } },
          { branchId: { in: testBranchIds } },
        ],
      },
      include: {
        lines: true,
      },
    });

    // -------------------------------------------------------------------------
    // 2. DISPLAY COUNTS & DETAILS (PRINT FOR DRY-RUN AND CONFIRM)
    // -------------------------------------------------------------------------

    console.log('========================================================================');
    console.log(`MODE: ${isConfirm ? '*** EXECUTION (--confirm) ***' : 'DRY-RUN (No changes will be made)'}`);
    console.log('========================================================================\n');

    console.log('--- GROUP 1: INTEGRATION TEST DATA (Targeted for deletion) ---');
    console.log(`- LoanApplication (test loans):     ${testLoans.length}`);
    console.log(`- LoanPayout (test payouts):         ${testPayouts.length}`);
    console.log(`- LoanPayoutReceipt (test receipts): ${testPayoutReceipts.length}`);
    console.log(`- LoanPayoutHistory (test history):  ${testPayoutHistory.length}`);
    console.log(`- User (test users):                 ${testUsers.length}`);
    console.log(`- Branch (test branches):            ${testBranches.length}`);
    console.log(`- UserBranch (test links):           ${testUserBranches.length}`);
    console.log(`- UserRole (test links):             ${testUserRoles.length}`);

    console.log('\n--- GROUP 2: PAYOUT ROWS ON REAL LOANS (Targeted for deletion) ---');
    console.log(`- Total unconfirmed payouts on real loans: ${realLoansPayouts.length}`);
    for (const p of realLoansPayouts) {
      console.log(`  * ID: ${p.id} | Loan: ${p.loan.customerName} (${p.loanId}) | Kind: ${p.kind} | Expected: ₹${p.expectedAmount} | Receipts: ${p.receipts.length} | History: ${p.history.length}`);
    }

    console.log('\n--- GROUP 3: GL JOURNAL ENTRIES (Finance & Accounting Data Review) ---');
    console.log(`- JournalEntry rows linked to test data: ${glTestEntries.length} (WILL NOT BE DELETED; preserve for Akash)`);
    if (glTestEntries.length > 0) {
      for (const je of glTestEntries) {
        console.log(`  * Entry #${je.entryNumber} | Ref: ${je.sourceReference} | Branch: ${je.branchId} | Lines: ${je.lines.length}`);
      }
    } else {
      console.log('  * Zero test GL journal entries found in database.');
    }
    console.log('------------------------------------------------------------------------\n');

    if (!isConfirm) {
      console.log('========================================================================');
      console.log('DRY-RUN COMPLETE: Zero database rows were modified.');
      console.log('To execute this cleanup in a single verified transaction, run:');
      console.log('  npx ts-node prisma/cleanup-test-data.ts --confirm');
      console.log('========================================================================');
      return;
    }

    // -------------------------------------------------------------------------
    // 3. EXECUTION IN A SINGLE VERIFIED TRANSACTION (--confirm)
    // -------------------------------------------------------------------------

    console.log('Starting atomic transaction for cleanup...\n');

    // Before counts
    const beforeLoans = await prisma.loanApplication.count();
    const beforePayouts = await prisma.loanPayout.count();
    const beforeUsers = await prisma.user.count();
    const beforeBranches = await prisma.branch.count();
    const beforeLenders = await prisma.lender.count();

    console.log('--- BEFORE COUNTS ---');
    console.log(`LoanApplication: ${beforeLoans}`);
    console.log(`LoanPayout:      ${beforePayouts}`);
    console.log(`User:            ${beforeUsers}`);
    console.log(`Branch:          ${beforeBranches}`);
    console.log(`Lender:          ${beforeLenders}`);
    console.log('---------------------\n');

    await prisma.$transaction(async (tx) => {
      // 1. Delete receipts and history on test payouts (if any)
      if (testPayoutIds.length > 0) {
        await tx.loanPayoutReceipt.deleteMany({
          where: { payoutId: { in: testPayoutIds } },
        });
        await tx.loanPayoutHistory.deleteMany({
          where: { payoutId: { in: testPayoutIds } },
        });
      }

      // 2. Delete test payouts (child of test loans)
      if (testPayoutIds.length > 0) {
        await tx.loanPayout.deleteMany({
          where: { id: { in: testPayoutIds } },
        });
      }

      // 3. Delete real loan payouts (Group 2)
      const realPayoutIds = realLoansPayouts.map((p) => p.id);
      if (realPayoutIds.length > 0) {
        await tx.loanPayout.deleteMany({
          where: { id: { in: realPayoutIds } },
        });
      }

      // 4. Delete test loans
      if (testLoanIds.length > 0) {
        await tx.loanApplication.deleteMany({
          where: { id: { in: testLoanIds } },
        });
      }

      // 5. Delete test user associations
      if (testUserIds.length > 0 || testBranchIds.length > 0) {
        await tx.userBranch.deleteMany({
          where: {
            OR: [
              { userId: { in: testUserIds } },
              { branchId: { in: testBranchIds } },
            ],
          },
        });
      }
      if (testUserIds.length > 0) {
        await tx.userRole.deleteMany({
          where: { userId: { in: testUserIds } },
        });
      }

      // 6. Delete test users
      if (testUserIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: testUserIds } },
        });
      }

      // 7. Delete test branches
      if (testBranchIds.length > 0) {
        await tx.branch.deleteMany({
          where: { id: { in: testBranchIds } },
        });
      }

      // 8. MANDATORY POST-CONDITION SAFETY VERIFICATION
      const afterLoans = await tx.loanApplication.count();
      const afterBranches = await tx.branch.count();
      const afterUsers = await tx.user.count();
      const afterLenders = await tx.lender.count();

      if (afterLoans !== 11) {
        throw new Error(`SAFETY INVARIANT FAILED: Expected exactly 11 LoanApplication rows, found ${afterLoans}. Transaction aborted.`);
      }
      if (afterBranches !== 5) {
        throw new Error(`SAFETY INVARIANT FAILED: Expected exactly 5 Branch rows, found ${afterBranches}. Transaction aborted.`);
      }
      if (afterUsers !== 13) {
        throw new Error(`SAFETY INVARIANT FAILED: Expected exactly 13 User rows, found ${afterUsers}. Transaction aborted.`);
      }
      if (afterLenders !== 36) {
        throw new Error(`SAFETY INVARIANT FAILED: Expected exactly 36 Lender rows, found ${afterLenders}. Transaction aborted.`);
      }

      console.log('All safety verification checks passed successfully!');
    }, { timeout: 30000 });

    // After counts
    const finalLoans = await prisma.loanApplication.count();
    const finalPayouts = await prisma.loanPayout.count();
    const finalUsers = await prisma.user.count();
    const finalBranches = await prisma.branch.count();
    const finalLenders = await prisma.lender.count();

    console.log('\n--- AFTER COUNTS (COMMITTED) ---');
    console.log(`LoanApplication: ${finalLoans} (Expected: 11)`);
    console.log(`LoanPayout:      ${finalPayouts} (Expected: 0)`);
    console.log(`User:            ${finalUsers} (Expected: 13)`);
    console.log(`Branch:          ${finalBranches} (Expected: 5)`);
    console.log(`Lender:          ${finalLenders} (Expected: 36)`);
    console.log('--------------------------------\n');

    console.log('Cleanup transaction successfully committed.');
  } catch (error) {
    console.error('Cleanup operation failed and was rolled back:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
