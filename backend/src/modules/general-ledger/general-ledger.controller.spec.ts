import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { GeneralLedgerController } from './general-ledger.controller';
import { AccountType, JournalStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('GeneralLedgerController', () => {
  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@nexus.local',
    department: 'FINANCE',
    roles: ['ACCOUNTANT'],
    permissions: [],
    branchIds: ['branch-mumbai'],
  };

  it('should delegate createAccount to the service', async () => {
    let calledWithUser: any = null;
    let calledWithDto: any = null;

    const mockService: any = {
      createAccount: async (user: any, dto: any) => {
        calledWithUser = user;
        calledWithDto = dto;
        return { id: 'acc-1', ...dto };
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const dto = {
      code: '1100',
      name: 'Accounts Receivable',
      type: AccountType.ASSET,
    };
    const result = await controller.createAccount({ user: mockUser }, dto);

    assert.strictEqual(calledWithUser.userId, 'user-1');
    assert.strictEqual(calledWithDto.code, '1100');
    assert.strictEqual(result.id, 'acc-1');
  });

  it('should delegate findAllAccounts to the service', async () => {
    let calledWithUser: any = null;
    let calledWithQuery: any = null;

    const mockService: any = {
      findAllAccounts: async (user: any, query: any) => {
        calledWithUser = user;
        calledWithQuery = query;
        return [{ id: 'acc-1', code: '1100', name: 'Accounts Receivable' }];
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const query = { type: AccountType.ASSET, branchId: 'branch-mumbai' };
    const result = await controller.findAllAccounts({ user: mockUser }, query);

    assert.strictEqual(calledWithUser.userId, 'user-1');
    assert.strictEqual(calledWithQuery.type, AccountType.ASSET);
    assert.strictEqual(result.length, 1);
  });

  it('should delegate findAccountById to the service', async () => {
    const mockService: any = {
      findAccountById: async (user: any, id: string) => {
        return { id, code: '1100', name: 'Accounts Receivable' };
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const result = await controller.findAccountById({ user: mockUser }, 'acc-1');

    assert.strictEqual(result.id, 'acc-1');
  });

  it('should delegate createJournalEntry to the service', async () => {
    let calledWithUser: any = null;
    let calledWithDto: any = null;

    const mockService: any = {
      createJournalEntry: async (user: any, dto: any) => {
        calledWithUser = user;
        calledWithDto = dto;
        return {
          id: 'je-1',
          entryNumber: 'JE-20261022-0001',
          status: JournalStatus.POSTED,
          ...dto,
        };
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const dto = {
      narration: 'Test entry',
      branchId: 'branch-mumbai',
      lines: [
        { accountId: 'acc-1', debitAmount: 100, creditAmount: 0 },
        { accountId: 'acc-2', debitAmount: 0, creditAmount: 100 },
      ],
    };
    const result = await controller.createJournalEntry({ user: mockUser }, dto);

    assert.strictEqual(calledWithUser.userId, 'user-1');
    assert.strictEqual(calledWithDto.narration, 'Test entry');
    assert.strictEqual(result.entryNumber, 'JE-20261022-0001');
  });

  it('should delegate findAllEntries to the service', async () => {
    let calledWithUser: any = null;
    let calledWithQuery: any = null;

    const mockService: any = {
      findAllEntries: async (user: any, query: any) => {
        calledWithUser = user;
        calledWithQuery = query;
        return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const query = { page: 1, limit: 10, branchId: 'branch-mumbai' };
    const result = await controller.findAllEntries({ user: mockUser }, query);

    assert.strictEqual(calledWithUser.userId, 'user-1');
    assert.strictEqual(calledWithQuery.limit, 10);
    assert.strictEqual(result.total, 0);
  });

  it('should delegate findEntryById to the service', async () => {
    const mockService: any = {
      findEntryById: async (user: any, id: string) => {
        return { id, entryNumber: 'JE-20261022-0001', branchId: 'branch-mumbai' };
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const result = await controller.findEntryById({ user: mockUser }, 'je-1');

    assert.strictEqual(result.id, 'je-1');
  });

  it('should delegate postDraftEntry to the service', async () => {
    let calledWithId: string | null = null;
    const mockService: any = {
      postDraftEntry: async (user: any, id: string) => {
        calledWithId = id;
        return { id, status: JournalStatus.POSTED, postingDate: new Date() };
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const result = await controller.postDraftEntry({ user: mockUser }, 'je-draft-1');

    assert.strictEqual(calledWithId, 'je-draft-1');
    assert.strictEqual(result.status, JournalStatus.POSTED);
  });

  it('should delegate voidJournalEntry to the service', async () => {
    let calledWithId: string | null = null;
    let calledWithDto: any = null;
    const mockService: any = {
      voidJournalEntry: async (user: any, id: string, dto: any) => {
        calledWithId = id;
        calledWithDto = dto;
        return { id, status: JournalStatus.VOID };
      },
    };

    const controller = new GeneralLedgerController(mockService);
    const result = await controller.voidJournalEntry(
      { user: mockUser },
      'je-1',
      { reason: 'Duplicate invoice' },
    );

    assert.strictEqual(calledWithId, 'je-1');
    assert.strictEqual(calledWithDto.reason, 'Duplicate invoice');
    assert.strictEqual(result.status, JournalStatus.VOID);
  });
});
