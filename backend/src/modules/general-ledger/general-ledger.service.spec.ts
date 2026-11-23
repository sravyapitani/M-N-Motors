import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { GeneralLedgerService } from './general-ledger.service';
import { AccountType, JournalStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('GeneralLedgerService', () => {
  const mockAdminUser: AuthenticatedUser = {
    userId: 'user-admin-1',
    email: 'admin@nexus.local',
    department: 'FINANCE',
    roles: ['SYSTEM_ADMIN'],
    permissions: [],
    branchIds: ['branch-mumbai', 'branch-pune'],
  };

  const mockBranchUser: AuthenticatedUser = {
    userId: 'user-staff-1',
    email: 'staff@nexus.local',
    department: 'FINANCE',
    roles: ['ACCOUNTANT'],
    permissions: [],
    branchIds: ['branch-mumbai'],
  };

  const mockBranch = {
    id: 'branch-mumbai',
    code: 'MUM',
    name: 'Mumbai Central',
  };

  const sampleAccounts = [
    {
      id: 'acc-cash',
      code: '1000',
      name: 'Cash on Hand',
      type: AccountType.ASSET,
      isActive: true,
      branchId: null,
      description: 'Cash account',
    },
    {
      id: 'acc-revenue',
      code: '4000',
      name: 'Commission Revenue',
      type: AccountType.REVENUE,
      isActive: true,
      branchId: null,
      description: 'Revenue account',
    },
    {
      id: 'acc-inactive',
      code: '9999',
      name: 'Old Suspense',
      type: AccountType.ASSET,
      isActive: false,
      branchId: null,
      description: 'Disabled account',
    },
    {
      id: 'acc-pune-local',
      code: '1010-PUN',
      name: 'Pune Petty Cash',
      type: AccountType.ASSET,
      isActive: true,
      branchId: 'branch-pune',
      description: 'Branch-specific cash',
    },
  ];

  describe('Chart of Accounts', () => {
    it('should successfully create an account', async () => {
      let createdAccount: any = null;
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findUnique: async () => null,
          create: async ({ data }: any) => {
            createdAccount = { id: 'acc-new-1', ...data };
            return createdAccount;
          },
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      const result = await service.createAccount(mockAdminUser, {
        code: '1100',
        name: 'Accounts Receivable',
        type: AccountType.ASSET,
        description: 'Trade debtors',
      });

      assert.equal(result.code, '1100');
      assert.equal(result.name, 'Accounts Receivable');
      assert.equal(result.type, AccountType.ASSET);
    });

    it('should reject creating an account with duplicate code', async () => {
      const mockPrisma: any = {
        account: {
          findUnique: async () => ({ id: 'acc-existing', code: '1100' }),
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      await assert.rejects(
        async () => {
          await service.createAccount(mockAdminUser, {
            code: '1100',
            name: 'Duplicate Account',
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

    it('should reject account creation if branch user does not have access to target branch', async () => {
      const mockPrisma: any = {};
      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createAccount(mockBranchUser, {
            code: '1100-PUN',
            name: 'Pune Account',
            type: AccountType.ASSET,
            branchId: 'branch-pune',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.match(err.message, /Access denied/);
          return true;
        },
      );
    });
  });

  describe('Journal Entry Posting & Balancing Invariants', () => {
    it('should successfully post a balanced journal entry atomically', async () => {
      let createdEntry: any = null;
      let transactionExecuted = false;

      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[1]],
        },
        journalEntry: {
          findUnique: async () => null,
          count: async () => 0,
        },
        $transaction: async (cb: any) => {
          transactionExecuted = true;
          return cb({
            journalEntry: {
              count: async () => 0,
              create: async ({ data }: any) => {
                createdEntry = {
                  id: 'je-1',
                  ...data,
                  lines: data.lines.create,
                };
                return createdEntry;
              },
            },
          });
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      const result = await service.createJournalEntry(mockBranchUser, {
        narration: 'Disbursement commission revenue recognized',
        branchId: 'branch-mumbai',
        sourceModule: 'FINANCE_LOAN',
        sourceReference: 'LOAN-12345',
        lines: [
          { accountId: 'acc-cash', debitAmount: 15000, creditAmount: 0 },
          { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 15000 },
        ],
      });

      assert.ok(transactionExecuted);
      assert.ok(result);
      assert.match(result.entryNumber, /^JE-\d{8}-0001$/);
      assert.equal(result.status, JournalStatus.POSTED);
      assert.equal(result.lines.length, 2);
    });

    it('should reject an unbalanced journal entry with BadRequestException', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Unbalanced entry test',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 10000, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 9000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /not balanced/);
          return true;
        },
      );
    });

    it('should reject an entry with fewer than two lines', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Single line entry',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 10000, creditAmount: 0 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /at least two lines/);
          return true;
        },
      );
    });

    it('should reject a journal line with both debit and credit amounts', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Both sides populated',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 1000, creditAmount: 500 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 500 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /either a debit or a credit amount, not both/);
          return true;
        },
      );
    });

    it('should reject a journal line with neither debit nor credit amounts', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Zero amounts',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 0, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 0 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /not both or neither/);
          return true;
        },
      );
    });

    it('should reject decimal amounts with more than 2 decimal places (fractional cents)', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Fractional cent test',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 100.555, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 100.555 },
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

    it('should reject direct creation with VOID status', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Direct VOID creation',
            branchId: 'branch-mumbai',
            status: JournalStatus.VOID,
            lines: [
              { accountId: 'acc-cash', debitAmount: 1000, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 1000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /cannot be created directly with VOID status/);
          return true;
        },
      );
    });

    it('should reject posting to an inactive account', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[2]], // inactive account
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Posting to inactive account',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 5000, creditAmount: 0 },
              { accountId: 'acc-inactive', debitAmount: 0, creditAmount: 5000 },
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

    it('should reject posting to an account belonging to a different branch', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[3]], // Pune local account in Mumbai entry
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Cross-branch account violation',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 5000, creditAmount: 0 },
              { accountId: 'acc-pune-local', debitAmount: 0, creditAmount: 5000 },
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
  });

  describe('Idempotency, Concurrency & Source Validation', () => {
    it('should reject partial source identifiers (sourceModule without sourceReference)', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[1]],
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Partial source test',
            branchId: 'branch-mumbai',
            sourceModule: 'FINANCE_LOAN',
            lines: [
              { accountId: 'acc-cash', debitAmount: 1000, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 1000 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /provided together, or both omitted/);
          return true;
        },
      );
    });

    it('should reject duplicate entry with identical sourceModule and sourceReference in pre-check', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[1]],
        },
        journalEntry: {
          findUnique: async () => ({
            id: 'je-existing',
            entryNumber: 'JE-20261022-0001',
            sourceModule: 'FINANCE_LOAN',
            sourceReference: 'LOAN-12345',
          }),
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Duplicate post attempt',
            branchId: 'branch-mumbai',
            sourceModule: 'FINANCE_LOAN',
            sourceReference: 'LOAN-12345',
            lines: [
              { accountId: 'acc-cash', debitAmount: 10000, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 10000 },
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

    it('should handle database unique-constraint P2002 collision on concurrent sourceModule_sourceReference insertion', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[1]],
        },
        journalEntry: {
          findUnique: async () => null, // Pre-check passed concurrently
        },
        $transaction: async (cb: any) => {
          return cb({
            journalEntry: {
              count: async () => 0,
              create: async () => {
                const err: any = new Error('Unique constraint failed');
                err.code = 'P2002';
                err.meta = { target: ['sourceModule', 'sourceReference'] };
                throw err;
              },
            },
          });
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Concurrent race condition',
            branchId: 'branch-mumbai',
            sourceModule: 'FINANCE_LOAN',
            sourceReference: 'LOAN-RACE-1',
            lines: [
              { accountId: 'acc-cash', debitAmount: 1000, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 1000 },
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

    it('should roll back completely on transaction failure without partial records', async () => {
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[1]],
        },
        journalEntry: {
          findUnique: async () => null,
        },
        $transaction: async (cb: any) => {
          return cb({
            journalEntry: {
              count: async () => 0,
              create: async () => {
                throw new Error('Database connection dropped mid-transaction');
              },
            },
          });
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Failing transaction',
            branchId: 'branch-mumbai',
            lines: [
              { accountId: 'acc-cash', debitAmount: 500, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 500 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof Error);
          return true;
        },
      );
    });
  });

  describe('Journal Entry Lifecycle (Draft, Post, Void)', () => {
    it('should successfully create a DRAFT entry with null postingDate', async () => {
      let createdEntry: any = null;
      const mockPrisma: any = {
        branch: {
          findUnique: async () => mockBranch,
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[1]],
        },
        $transaction: async (cb: any) => {
          return cb({
            journalEntry: {
              count: async () => 0,
              create: async ({ data }: any) => {
                createdEntry = { id: 'je-draft-1', ...data, lines: data.lines.create };
                return createdEntry;
              },
            },
          });
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      const result = await service.createJournalEntry(mockBranchUser, {
        narration: 'Draft entry test',
        branchId: 'branch-mumbai',
        status: JournalStatus.DRAFT,
        lines: [
          { accountId: 'acc-cash', debitAmount: 1000, creditAmount: 0 },
          { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 1000 },
        ],
      });

      assert.equal(result.status, JournalStatus.DRAFT);
      assert.equal(result.postingDate, null);
    });

    it('should post a DRAFT entry and assign postingDate', async () => {
      const mockPrisma: any = {
        journalEntry: {
          findUnique: async () => ({
            id: 'je-draft-1',
            status: JournalStatus.DRAFT,
            branchId: 'branch-mumbai',
          }),
          update: async ({ data }: any) => ({
            id: 'je-draft-1',
            status: data.status,
            postingDate: data.postingDate,
            branchId: 'branch-mumbai',
          }),
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      const result = await service.postDraftEntry(mockBranchUser, 'je-draft-1');

      assert.equal(result.status, JournalStatus.POSTED);
      assert.ok(result.postingDate instanceof Date);
    });

    it('should reject posting an already POSTED journal entry', async () => {
      const mockPrisma: any = {
        journalEntry: {
          findUnique: async () => ({
            id: 'je-posted-1',
            status: JournalStatus.POSTED,
            branchId: 'branch-mumbai',
          }),
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.postDraftEntry(mockBranchUser, 'je-posted-1');
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /already posted/);
          return true;
        },
      );
    });

    it('should void a POSTED entry, preserving audit trail and history', async () => {
      let updatedData: any = null;
      const mockPrisma: any = {
        journalEntry: {
          findUnique: async () => ({
            id: 'je-posted-1',
            entryNumber: 'JE-20261022-0001',
            narration: 'Original loan disbursement',
            status: JournalStatus.POSTED,
            branchId: 'branch-mumbai',
          }),
          update: async ({ data }: any) => {
            updatedData = data;
            return {
              id: 'je-posted-1',
              status: data.status,
              narration: data.narration,
              branchId: 'branch-mumbai',
            };
          },
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      const result = await service.voidJournalEntry(mockBranchUser, 'je-posted-1', {
        reason: 'Customer cancelled transaction before clearance',
      });

      assert.equal(result.status, JournalStatus.VOID);
      assert.match(result.narration, /Original loan disbursement \[VOIDED: Customer cancelled transaction before clearance\]/);
      assert.equal(updatedData.status, JournalStatus.VOID);
    });

    it('should reject voiding an already VOID entry', async () => {
      const mockPrisma: any = {
        journalEntry: {
          findUnique: async () => ({
            id: 'je-void-1',
            status: JournalStatus.VOID,
            branchId: 'branch-mumbai',
          }),
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.voidJournalEntry(mockBranchUser, 'je-void-1');
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /already voided/);
          return true;
        },
      );
    });

    it('should reject voiding a DRAFT entry with BadRequestException', async () => {
      const mockPrisma: any = {
        journalEntry: {
          findUnique: async () => ({
            id: 'je-draft-1',
            status: JournalStatus.DRAFT,
            branchId: 'branch-mumbai',
          }),
        },
      };

      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.voidJournalEntry(mockBranchUser, 'je-draft-1');
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /Only posted journal entries can be voided/);
          return true;
        },
      );
    });
  });

  describe('Multi-tenant Branch Isolation', () => {
    it('should reject journal entry creation if user lacks access to branch', async () => {
      const mockPrisma: any = {};
      const service = new GeneralLedgerService(mockPrisma);

      await assert.rejects(
        async () => {
          await service.createJournalEntry(mockBranchUser, {
            narration: 'Unauthorized branch entry',
            branchId: 'branch-pune',
            lines: [
              { accountId: 'acc-cash', debitAmount: 1000, creditAmount: 0 },
              { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 1000 },
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

    it('should allow admin user to create entry for any branch', async () => {
      let transactionRan = false;
      const mockPrisma: any = {
        branch: {
          findUnique: async () => ({ id: 'branch-pune', code: 'PUN', name: 'Pune' }),
        },
        account: {
          findMany: async () => [sampleAccounts[0], sampleAccounts[1]],
        },
        journalEntry: {
          findUnique: async () => null,
        },
        $transaction: async (cb: any) => {
          transactionRan = true;
          return cb({
            journalEntry: {
              count: async () => 0,
              create: async ({ data }: any) => ({
                id: 'je-admin-1',
                ...data,
                lines: data.lines.create,
              }),
            },
          });
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      const result = await service.createJournalEntry(mockAdminUser, {
        narration: 'Admin entry for Pune branch',
        branchId: 'branch-pune',
        lines: [
          { accountId: 'acc-cash', debitAmount: 20000, creditAmount: 0 },
          { accountId: 'acc-revenue', debitAmount: 0, creditAmount: 20000 },
        ],
      });

      assert.ok(transactionRan);
      assert.equal(result.branchId, 'branch-pune');
    });

    it('should restrict findAllEntries to user branchIds for non-admin users', async () => {
      let capturedWhere: any = null;
      const mockPrisma: any = {
        journalEntry: {
          count: async ({ where }: any) => {
            capturedWhere = where;
            return 1;
          },
          findMany: async () => [{ id: 'je-1', branchId: 'branch-mumbai' }],
        },
      };

      const service = new GeneralLedgerService(mockPrisma);
      const result = await service.findAllEntries(mockBranchUser, {});

      assert.deepEqual(capturedWhere.branchId, { in: ['branch-mumbai'] });
      assert.equal(result.total, 1);
    });
  });
});
