import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneralLedgerService } from './general-ledger.service';
import { AccountType, JournalStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('GeneralLedgerService — Real Database Integration Tests', () => {
  let prisma: PrismaService;
  let ledgerService: GeneralLedgerService;

  const testRunId = Date.now().toString().slice(-6);
  const testPrefix = `T${testRunId}_`;

  let testBranch1: { id: string; code: string; name: string };
  let testBranch2: { id: string; code: string; name: string };
  let testUser: { id: string; email: string };
  let adminDbUser: { id: string; email: string };

  let adminUser: AuthenticatedUser;
  let branch1User: AuthenticatedUser;

  // Track created entity IDs for safe cleanup
  const createdAccountIds: string[] = [];
  const createdJournalEntryIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdUserIds: string[] = [];

  before(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledgerService = new GeneralLedgerService(prisma);

    // 1. Fetch or identify existing admin user
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@nexus.local' },
    });
    if (existingAdmin) {
      adminDbUser = existingAdmin;
    } else {
      adminDbUser = await prisma.user.create({
        data: {
          email: `${testPrefix}admin@nexus.local`,
          firstName: 'Test',
          lastName: 'Admin',
        },
      });
      createdUserIds.push(adminDbUser.id);
    }

    // 2. Create isolated test branches
    testBranch1 = await prisma.branch.create({
      data: {
        code: `${testPrefix}B1`,
        name: `Test Branch 1 (${testRunId})`,
      },
    });
    createdBranchIds.push(testBranch1.id);

    testBranch2 = await prisma.branch.create({
      data: {
        code: `${testPrefix}B2`,
        name: `Test Branch 2 (${testRunId})`,
      },
    });
    createdBranchIds.push(testBranch2.id);

    // 3. Create isolated test staff user
    testUser = await prisma.user.create({
      data: {
        email: `${testPrefix}staff@nexus.local`,
        firstName: 'Test',
        lastName: 'Staff',
      },
    });
    createdUserIds.push(testUser.id);

    // Assign staff user to testBranch1
    await prisma.userBranch.create({
      data: {
        userId: testUser.id,
        branchId: testBranch1.id,
      },
    });

    // 4. Construct AuthenticatedUser contexts
    adminUser = {
      userId: adminDbUser.id,
      email: adminDbUser.email,
      department: 'FINANCE',
      roles: ['SYSTEM_ADMIN'],
      permissions: [],
      branchIds: [testBranch1.id, testBranch2.id],
    };

    branch1User = {
      userId: testUser.id,
      email: testUser.email,
      department: 'FINANCE',
      roles: ['ACCOUNTANT'],
      permissions: [],
      branchIds: [testBranch1.id],
    };
  });

  after(async () => {
    // Clean up test records strictly in dependency order
    try {
      if (createdJournalEntryIds.length > 0) {
        await prisma.journalLine.deleteMany({
          where: { journalEntryId: { in: createdJournalEntryIds } },
        });
        await prisma.journalEntry.deleteMany({
          where: { id: { in: createdJournalEntryIds } },
        });
      }

      if (createdAccountIds.length > 0) {
        await prisma.account.deleteMany({
          where: { id: { in: createdAccountIds } },
        });
      }

      if (testUser?.id) {
        await prisma.userBranch.deleteMany({
          where: { userId: testUser.id },
        });
      }

      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }

      if (createdBranchIds.length > 0) {
        await prisma.branch.deleteMany({
          where: { id: { in: createdBranchIds } },
        });
      }
    } catch (cleanupErr) {
      console.error('Test cleanup encountered an error:', cleanupErr);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('Chart of Accounts Persistence & Retrieval', () => {
    it('should create an account and verify persistence in PostgreSQL', async () => {
      const code = `${testPrefix}1000`;
      const account = await ledgerService.createAccount(branch1User, {
        code,
        name: 'Test Cash Account',
        type: AccountType.ASSET,
        description: 'Test Cash in Hand',
        branchId: testBranch1.id,
      });

      createdAccountIds.push(account.id);
      assert.ok(account.id);
      assert.equal(account.code, code);

      // Verify directly from PostgreSQL
      const dbAccount = await prisma.account.findUnique({
        where: { id: account.id },
        include: { branch: true },
      });

      assert.ok(dbAccount);
      assert.equal(dbAccount.code, code);
      assert.equal(dbAccount.name, 'Test Cash Account');
      assert.equal(dbAccount.type, AccountType.ASSET);
      assert.equal(dbAccount.branchId, testBranch1.id);
      assert.equal(dbAccount.isActive, true);
    });

    it('should retrieve the account by ID and via query filtering', async () => {
      const code = `${testPrefix}1000`;
      const account = await prisma.account.findUniqueOrThrow({ where: { code } });

      const byId = await ledgerService.findAccountById(branch1User, account.id);
      assert.equal(byId.id, account.id);
      assert.equal(byId.code, code);

      const list = await ledgerService.findAllAccounts(branch1User, {
        branchId: testBranch1.id,
        search: code,
      });
      assert.ok(list.some((a) => a.id === account.id));
    });

    it('should enforce unique constraint on account code in PostgreSQL', async () => {
      const code = `${testPrefix}1000`;
      await assert.rejects(
        async () => {
          await ledgerService.createAccount(adminUser, {
            code,
            name: 'Duplicate Code Account',
            type: AccountType.ASSET,
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.match(err.message, /already exists/);
          return true;
        },
      );
    });
  });

  describe('Journal Entry Persistence, Invariants & Real DB Rollback', () => {
    let cashAccountId: string;
    let revenueAccountId: string;

    before(async () => {
      // Create accounts for journal entries
      const cashAcc = await prisma.account.findUniqueOrThrow({
        where: { code: `${testPrefix}1000` },
      });
      cashAccountId = cashAcc.id;

      const revAcc = await ledgerService.createAccount(branch1User, {
        code: `${testPrefix}4000`,
        name: 'Test Revenue Account',
        type: AccountType.REVENUE,
        branchId: testBranch1.id,
      });
      createdAccountIds.push(revAcc.id);
      revenueAccountId = revAcc.id;
    });

    it('should persist a balanced journal entry and its lines in PostgreSQL atomically', async () => {
      const entry = await ledgerService.createJournalEntry(branch1User, {
        branchId: testBranch1.id,
        narration: 'Test customer payment entry',
        sourceModule: 'TEST_MODULE',
        sourceReference: `${testPrefix}REF_001`,
        lines: [
          {
            accountId: cashAccountId,
            description: 'Debit Cash',
            debitAmount: 75000.50,
            creditAmount: 0,
          },
          {
            accountId: revenueAccountId,
            description: 'Credit Revenue',
            debitAmount: 0,
            creditAmount: 75000.50,
          },
        ],
      });

      createdJournalEntryIds.push(entry.id);
      assert.ok(entry.id);
      assert.match(entry.entryNumber, /^JE-\d{8}-\d{4}$/);
      assert.equal(entry.status, JournalStatus.POSTED);

      // Verify persistence in PostgreSQL
      const dbEntry = await prisma.journalEntry.findUnique({
        where: { id: entry.id },
        include: { lines: { orderBy: { debitAmount: 'desc' } } },
      });

      assert.ok(dbEntry);
      assert.equal(dbEntry.entryNumber, entry.entryNumber);
      assert.equal(dbEntry.branchId, testBranch1.id);
      assert.equal(dbEntry.status, JournalStatus.POSTED);
      assert.equal(dbEntry.lines.length, 2);

      // Verify line amounts and decimal scale (Decimal(14,2))
      assert.equal(Number(dbEntry.lines[0].debitAmount), 75000.50);
      assert.equal(Number(dbEntry.lines[0].creditAmount), 0);
      assert.equal(Number(dbEntry.lines[1].debitAmount), 0);
      assert.equal(Number(dbEntry.lines[1].creditAmount), 75000.50);
    });

    it('should reject an unbalanced journal entry and ensure zero records are inserted', async () => {
      const beforeCount = await prisma.journalEntry.count({
        where: { branchId: testBranch1.id },
      });

      await assert.rejects(
        async () => {
          await ledgerService.createJournalEntry(branch1User, {
            branchId: testBranch1.id,
            narration: 'Unbalanced entry',
            lines: [
              { accountId: cashAccountId, debitAmount: 50000, creditAmount: 0 },
              { accountId: revenueAccountId, debitAmount: 0, creditAmount: 49000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /not balanced/);
          return true;
        },
      );

      const afterCount = await prisma.journalEntry.count({
        where: { branchId: testBranch1.id },
      });
      assert.equal(afterCount, beforeCount);
    });

    it('should reject fractional cents (> 2 decimal places) before hitting the database', async () => {
      await assert.rejects(
        async () => {
          await ledgerService.createJournalEntry(branch1User, {
            branchId: testBranch1.id,
            narration: 'Fractional cent test',
            lines: [
              { accountId: cashAccountId, debitAmount: 100.555, creditAmount: 0 },
              { accountId: revenueAccountId, debitAmount: 0, creditAmount: 100.555 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /cannot have more than 2 decimal places/);
          return true;
        },
      );
    });

    it('should reject an inactive account', async () => {
      const inactiveAcc = await ledgerService.createAccount(adminUser, {
        code: `${testPrefix}INACT`,
        name: 'Inactive Suspense Account',
        type: AccountType.ASSET,
        branchId: testBranch1.id,
      });
      createdAccountIds.push(inactiveAcc.id);

      // Deactivate directly in database
      await prisma.account.update({
        where: { id: inactiveAcc.id },
        data: { isActive: false },
      });

      await assert.rejects(
        async () => {
          await ledgerService.createJournalEntry(branch1User, {
            branchId: testBranch1.id,
            narration: 'Inactive account post attempt',
            lines: [
              { accountId: inactiveAcc.id, debitAmount: 1000, creditAmount: 0 },
              { accountId: revenueAccountId, debitAmount: 0, creditAmount: 1000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /is inactive/);
          return true;
        },
      );
    });

    it('should reject using an account belonging to another branch', async () => {
      const branch2Acc = await ledgerService.createAccount(adminUser, {
        code: `${testPrefix}PUN_CASH`,
        name: 'Pune Petty Cash',
        type: AccountType.ASSET,
        branchId: testBranch2.id,
      });
      createdAccountIds.push(branch2Acc.id);

      // Attempt to post in Branch 1 using Branch 2 account
      await assert.rejects(
        async () => {
          await ledgerService.createJournalEntry(branch1User, {
            branchId: testBranch1.id,
            narration: 'Cross-branch account violation',
            lines: [
              { accountId: branch2Acc.id, debitAmount: 2000, creditAmount: 0 },
              { accountId: revenueAccountId, debitAmount: 0, creditAmount: 2000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /cannot be used in branch/);
          return true;
        },
      );
    });

    it('should enforce idempotency and reject duplicate sourceModule and sourceReference in PostgreSQL', async () => {
      const sourceModule = 'FINANCE_LOAN';
      const sourceReference = `${testPrefix}LOAN_DUPLICATE_TEST`;

      const firstEntry = await ledgerService.createJournalEntry(branch1User, {
        branchId: testBranch1.id,
        narration: 'First loan disbursement recognition',
        sourceModule,
        sourceReference,
        lines: [
          { accountId: cashAccountId, debitAmount: 10000, creditAmount: 0 },
          { accountId: revenueAccountId, debitAmount: 0, creditAmount: 10000 },
        ],
      });
      createdJournalEntryIds.push(firstEntry.id);

      // Second attempt with exact same source reference
      await assert.rejects(
        async () => {
          await ledgerService.createJournalEntry(branch1User, {
            branchId: testBranch1.id,
            narration: 'Duplicate loan disbursement recognition',
            sourceModule,
            sourceReference,
            lines: [
              { accountId: cashAccountId, debitAmount: 10000, creditAmount: 0 },
              { accountId: revenueAccountId, debitAmount: 0, creditAmount: 10000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.match(err.message, /already exists/);
          return true;
        },
      );
    });

    it('should enforce PostgreSQL foreign key constraint on journal line accountId', async () => {
      await assert.rejects(
        async () => {
          await ledgerService.createJournalEntry(branch1User, {
            branchId: testBranch1.id,
            narration: 'Non-existent account FK test',
            lines: [
              { accountId: 'non_existent_cuid_123', debitAmount: 1000, creditAmount: 0 },
              { accountId: revenueAccountId, debitAmount: 0, creditAmount: 1000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /Accounts not found/);
          return true;
        },
      );
    });
  });

  describe('Journal Entry Lifecycle: Draft -> Posted -> Void in PostgreSQL', () => {
    let cashAccountId: string;
    let revenueAccountId: string;

    before(async () => {
      const cashAcc = await prisma.account.findUniqueOrThrow({
        where: { code: `${testPrefix}1000` },
      });
      const revAcc = await prisma.account.findUniqueOrThrow({
        where: { code: `${testPrefix}4000` },
      });
      cashAccountId = cashAcc.id;
      revenueAccountId = revAcc.id;
    });

    it('should create a DRAFT entry with null postingDate and allow posting later', async () => {
      const draft = await ledgerService.createJournalEntry(branch1User, {
        branchId: testBranch1.id,
        narration: 'Draft journal entry test',
        status: JournalStatus.DRAFT,
        lines: [
          { accountId: cashAccountId, debitAmount: 12000, creditAmount: 0 },
          { accountId: revenueAccountId, debitAmount: 0, creditAmount: 12000 },
        ],
      });
      createdJournalEntryIds.push(draft.id);

      assert.equal(draft.status, JournalStatus.DRAFT);
      assert.equal(draft.postingDate, null);

      // Post the draft
      const posted = await ledgerService.postDraftEntry(branch1User, draft.id);
      assert.equal(posted.status, JournalStatus.POSTED);
      assert.ok(posted.postingDate instanceof Date);

      // Verify in PostgreSQL
      const dbEntry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: draft.id },
      });
      assert.equal(dbEntry.status, JournalStatus.POSTED);
      assert.ok(dbEntry.postingDate !== null);
    });

    it('should void a POSTED entry, preserving full audit history and lines in PostgreSQL', async () => {
      const entry = await ledgerService.createJournalEntry(branch1User, {
        branchId: testBranch1.id,
        narration: 'Vouchered commission entry to void',
        lines: [
          { accountId: cashAccountId, debitAmount: 30000, creditAmount: 0 },
          { accountId: revenueAccountId, debitAmount: 0, creditAmount: 30000 },
        ],
      });
      createdJournalEntryIds.push(entry.id);

      // Void the entry
      const voided = await ledgerService.voidJournalEntry(branch1User, entry.id, {
        reason: 'Loan cancelled before funds transferred',
      });

      assert.equal(voided.status, JournalStatus.VOID);
      assert.match(voided.narration, /\[VOIDED: Loan cancelled before funds transferred\]/);

      // Verify directly in PostgreSQL
      const dbEntry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: { lines: true },
      });

      assert.equal(dbEntry.status, JournalStatus.VOID);
      assert.match(dbEntry.narration, /\[VOIDED: Loan cancelled before funds transferred\]/);
      assert.equal(dbEntry.lines.length, 2); // Lines remain intact
      assert.equal(Number(dbEntry.lines[0].debitAmount) + Number(dbEntry.lines[1].creditAmount), 60000);
    });

    it('should reject voiding an already VOID entry', async () => {
      const voidedEntryId = createdJournalEntryIds[createdJournalEntryIds.length - 1];

      await assert.rejects(
        async () => {
          await ledgerService.voidJournalEntry(branch1User, voidedEntryId, {
            reason: 'Second void attempt',
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /already voided/);
          return true;
        },
      );
    });
  });

  describe('Branch Security and Cross-Branch Access in PostgreSQL', () => {
    let cashAccountId: string;
    let revenueAccountId: string;

    before(async () => {
      const cashAcc = await prisma.account.findUniqueOrThrow({
        where: { code: `${testPrefix}1000` },
      });
      const revAcc = await prisma.account.findUniqueOrThrow({
        where: { code: `${testPrefix}4000` },
      });
      cashAccountId = cashAcc.id;
      revenueAccountId = revAcc.id;
    });

    it('should reject non-admin user creating a journal entry in a branch they do not belong to', async () => {
      await assert.rejects(
        async () => {
          await ledgerService.createJournalEntry(branch1User, {
            branchId: testBranch2.id, // User only has testBranch1
            narration: 'Unauthorized branch 2 attempt',
            lines: [
              { accountId: cashAccountId, debitAmount: 5000, creditAmount: 0 },
              { accountId: revenueAccountId, debitAmount: 0, creditAmount: 5000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.match(err.message, /Access denied/);
          return true;
        },
      );
    });

    it('should allow SYSTEM_ADMIN user to post entries across any branch in PostgreSQL', async () => {
      // Create accounts in branch 2
      const b2Cash = await ledgerService.createAccount(adminUser, {
        code: `${testPrefix}B2_CASH`,
        name: 'Branch 2 Cash',
        type: AccountType.ASSET,
        branchId: testBranch2.id,
      });
      createdAccountIds.push(b2Cash.id);

      const b2Rev = await ledgerService.createAccount(adminUser, {
        code: `${testPrefix}B2_REV`,
        name: 'Branch 2 Revenue',
        type: AccountType.REVENUE,
        branchId: testBranch2.id,
      });
      createdAccountIds.push(b2Rev.id);

      const adminEntry = await ledgerService.createJournalEntry(adminUser, {
        branchId: testBranch2.id,
        narration: 'Admin cross-branch posting in Branch 2',
        lines: [
          { accountId: b2Cash.id, debitAmount: 45000, creditAmount: 0 },
          { accountId: b2Rev.id, debitAmount: 0, creditAmount: 45000 },
        ],
      });
      createdJournalEntryIds.push(adminEntry.id);

      assert.ok(adminEntry.id);
      assert.equal(adminEntry.branchId, testBranch2.id);

      const dbEntry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: adminEntry.id },
      });
      assert.equal(dbEntry.branchId, testBranch2.id);
    });
  });
});
