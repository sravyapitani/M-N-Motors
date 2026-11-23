import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JournalQueryDto } from './dto/journal-query.dto';
import { VoidJournalEntryDto } from './dto/void-journal-entry.dto';
import { JournalStatus, Prisma } from '../../generated/prisma/client';

@Injectable()
export class GeneralLedgerService {
  private readonly logger = new Logger(GeneralLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to verify if the user is a System Administrator
   */
  private isAdmin(user?: AuthenticatedUser): boolean {
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    return (
      roles.includes('SYSTEM_ADMIN') ||
      permissions.includes('SYSTEM_ADMIN')
    );
  }

  /**
   * Helper to verify if the user has permission to access the target branch
   */
  private verifyBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (this.isAdmin(user)) {
      return;
    }
    if (!branchId || typeof branchId !== 'string' || !branchId.trim()) {
      throw new BadRequestException('A valid branch ID is required.');
    }
    const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
    if (!userBranchIds.includes(branchId.trim())) {
      throw new ForbiddenException(
        `Access denied: You do not have permission to access branch '${branchId}'.`,
      );
    }
  }

  // ==========================================
  // CHART OF ACCOUNTS
  // ==========================================

  /**
   * Create a new ledger account
   */
  async createAccount(user: AuthenticatedUser, dto: CreateAccountDto) {
    if (!user?.userId) {
      throw new UnauthorizedException('A valid authenticated user session is required.');
    }

    const code = dto.code.trim().toUpperCase();
    const branchId = dto.branchId?.trim();

    if (branchId) {
      this.verifyBranchAccess(user, branchId);
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID '${branchId}' does not exist.`);
      }
    }

    const existing = await this.prisma.account.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`An account with code '${code}' already exists.`);
    }

    try {
      return await this.prisma.account.create({
        data: {
          code,
          name: dto.name.trim(),
          type: dto.type,
          description: dto.description?.trim() || null,
          branchId: branchId || null,
        },
        include: {
          branch: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create account ${code}: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error creating account.');
    }
  }

  /**
   * List chart of accounts with filtering
   */
  async findAllAccounts(user: AuthenticatedUser, query: AccountQueryDto) {
    const where: Prisma.AccountWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (typeof query.isActive === 'boolean') {
      where.isActive = query.isActive;
    }

    const requestedBranch = query.branchId?.trim();
    if (requestedBranch) {
      this.verifyBranchAccess(user, requestedBranch);
      where.OR = [{ branchId: requestedBranch }, { branchId: null }];
    } else if (!this.isAdmin(user)) {
      const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
      where.OR = [
        { branchId: null },
        ...(userBranchIds.length > 0 ? [{ branchId: { in: userBranchIds } }] : []),
      ];
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { code: { contains: term, mode: 'insensitive' } },
            { name: { contains: term, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.account.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      include: {
        branch: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Find an account by ID
   */
  async findAccountById(user: AuthenticatedUser, id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID '${id}' was not found.`);
    }

    if (account.branchId) {
      this.verifyBranchAccess(user, account.branchId);
    }

    return account;
  }

  // ==========================================
  // JOURNAL ENTRIES
  // ==========================================

  /**
   * Create and record a balanced journal entry atomically.
   */
  async createJournalEntry(
    user: AuthenticatedUser,
    dto: CreateJournalEntryDto,
    externalTx?: Prisma.TransactionClient,
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('A valid authenticated user session is required.');
    }

    const branchId = dto.branchId?.trim();
    if (!branchId) {
      throw new BadRequestException('A valid branch ID is required.');
    }
    this.verifyBranchAccess(user, branchId);

    // Verify branch existence
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID '${branchId}' does not exist.`);
    }

    // Invariant: At least 2 lines
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException('A journal entry must contain at least two lines.');
    }

    // Direct creation as VOID is prohibited
    if (dto.status === JournalStatus.VOID) {
      throw new BadRequestException('A new journal entry cannot be created directly with VOID status.');
    }

    // Target status: DRAFT or POSTED (default: POSTED)
    const targetStatus =
      dto.status === JournalStatus.DRAFT ? JournalStatus.DRAFT : JournalStatus.POSTED;
    const postingDate = targetStatus === JournalStatus.POSTED ? new Date() : null;

    // Validate lines and calculate balance using integer cents
    let totalDebitCents = 0;
    let totalCreditCents = 0;

    const validatedLines = dto.lines.map((line, index) => {
      const debit = Number(line.debitAmount ?? 0);
      const credit = Number(line.creditAmount ?? 0);

      if (isNaN(debit) || isNaN(credit)) {
        throw new BadRequestException(`Line ${index + 1}: Amounts must be valid numbers.`);
      }

      if (debit < 0 || credit < 0) {
        throw new BadRequestException(`Line ${index + 1}: Debit and credit amounts cannot be negative.`);
      }

      // Check decimal precision (max 2 decimal places)
      if (
        Math.abs(debit * 100 - Math.round(debit * 100)) > 1e-4 ||
        Math.abs(credit * 100 - Math.round(credit * 100)) > 1e-4
      ) {
        throw new BadRequestException(
          `Line ${index + 1}: Amounts cannot have more than 2 decimal places.`,
        );
      }

      const debitCents = Math.round(debit * 100);
      const creditCents = Math.round(credit * 100);

      if ((debitCents > 0 && creditCents > 0) || (debitCents === 0 && creditCents === 0)) {
        throw new BadRequestException(
          `Line ${index + 1}: Each journal line must contain either a debit or a credit amount, not both or neither.`,
        );
      }

      totalDebitCents += debitCents;
      totalCreditCents += creditCents;

      return {
        accountId: line.accountId.trim(),
        description: line.description?.trim() || null,
        debitAmount: debitCents / 100,
        creditAmount: creditCents / 100,
      };
    });

    // Invariant: Exact double-entry balancing
    if (totalDebitCents !== totalCreditCents) {
      throw new BadRequestException(
        `Journal entry is not balanced. Total debits (${(totalDebitCents / 100).toFixed(2)}) must equal total credits (${(totalCreditCents / 100).toFixed(2)}). Difference: ${Math.abs(totalDebitCents - totalCreditCents) / 100}`,
      );
    }

    // Verify accounts exist and are active
    const accountIds = [...new Set(validatedLines.map((l) => l.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
    });

    if (accounts.length !== accountIds.length) {
      const foundIds = new Set(accounts.map((a) => a.id));
      const missing = accountIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Accounts not found: ${missing.join(', ')}`);
    }

    for (const acc of accounts) {
      if (!acc.isActive) {
        throw new BadRequestException(`Account '${acc.code}' (${acc.name}) is inactive.`);
      }
      if (acc.branchId && acc.branchId !== branchId) {
        throw new BadRequestException(
          `Account '${acc.code}' belongs to branch '${acc.branchId}' and cannot be used in branch '${branchId}'.`,
        );
      }
    }

    // Source identifier validation: both must be present or both omitted
    const sourceModule = dto.sourceModule?.trim() || null;
    const sourceReference = dto.sourceReference?.trim() || null;

    if ((sourceModule && !sourceReference) || (!sourceModule && sourceReference)) {
      throw new BadRequestException(
        'Both sourceModule and sourceReference must be provided together, or both omitted.',
      );
    }

    // Idempotency check if source module and reference are provided
    if (sourceModule && sourceReference) {
      const existingEntry = await this.prisma.journalEntry.findUnique({
        where: {
          sourceModule_sourceReference: {
            sourceModule,
            sourceReference,
          },
        },
      });
      if (existingEntry) {
        throw new ConflictException(
          `A journal entry for source module '${sourceModule}' with reference '${sourceReference}' already exists (Entry: ${existingEntry.entryNumber}).`,
        );
      }
    }

    const entryDate = dto.entryDate ? new Date(dto.entryDate) : new Date();

    // Execute within transaction
    const execute = async (tx: Prisma.TransactionClient) => {
      const dateStr = entryDate.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = `JE-${dateStr}`;

      const count = await tx.journalEntry.count({
        where: {
          entryNumber: { startsWith: prefix },
        },
      });
      const entryNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

      try {
        return await tx.journalEntry.create({
          data: {
            entryNumber,
            entryDate,
            postingDate,
            status: targetStatus,
            sourceModule,
            sourceReference,
            narration: dto.narration.trim(),
            branchId,
            createdById: user.userId,
            lines: {
              create: validatedLines.map((l) => ({
                accountId: l.accountId,
                description: l.description,
                debitAmount: l.debitAmount,
                creditAmount: l.creditAmount,
              })),
            },
          },
          include: {
            branch: { select: { id: true, code: true, name: true } },
            createdBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true, type: true } },
              },
            },
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const targetStr = JSON.stringify(err.meta?.target || '');
          if (
            targetStr.includes('sourceModule') ||
            targetStr.includes('source_module') ||
            (sourceModule && sourceReference && !targetStr.includes('entryNumber'))
          ) {
            throw new ConflictException(
              `A journal entry for source module '${sourceModule}' with reference '${sourceReference}' already exists.`,
            );
          }
          throw new ConflictException(
            `A journal entry with this entry number already exists. Please retry.`,
          );
        }
        throw err;
      }
    };

    if (externalTx) {
      return execute(externalTx);
    }

    try {
      return await this.prisma.$transaction(execute);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Failed to post journal entry: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error posting journal entry.');
    }
  }

  /**
   * Post a draft journal entry
   */
  async postDraftEntry(user: AuthenticatedUser, id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        lines: true,
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with ID '${id}' was not found.`);
    }

    this.verifyBranchAccess(user, entry.branchId);

    if (entry.status === JournalStatus.POSTED) {
      throw new BadRequestException('Journal entry is already posted.');
    }

    if (entry.status === JournalStatus.VOID) {
      throw new BadRequestException('Voided journal entries cannot be posted.');
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: JournalStatus.POSTED,
        postingDate: new Date(),
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });
  }

  /**
   * Void a posted journal entry, preserving full audit history.
   */
  async voidJournalEntry(
    user: AuthenticatedUser,
    id: string,
    dto?: VoidJournalEntryDto,
  ) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        lines: true,
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with ID '${id}' was not found.`);
    }

    this.verifyBranchAccess(user, entry.branchId);

    if (entry.status === JournalStatus.VOID) {
      throw new BadRequestException('Journal entry is already voided.');
    }

    if (entry.status !== JournalStatus.POSTED) {
      throw new BadRequestException('Only posted journal entries can be voided.');
    }

    const reason = dto?.reason?.trim();
    const updatedNarration = reason
      ? `${entry.narration} [VOIDED: ${reason}]`
      : `${entry.narration} [VOIDED]`;

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: JournalStatus.VOID,
        narration: updatedNarration,
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });
  }

  /**
   * List journal entries with filters and pagination
   */
  async findAllEntries(user: AuthenticatedUser, query: JournalQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;

    let branchFilter: string | { in: string[] } | undefined;
    const requestedBranch = query.branchId?.trim();
    if (requestedBranch) {
      this.verifyBranchAccess(user, requestedBranch);
      branchFilter = requestedBranch;
    } else if (!this.isAdmin(user)) {
      const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
      if (userBranchIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      branchFilter = { in: userBranchIds };
    }

    const where: Prisma.JournalEntryWhereInput = {};

    if (branchFilter) {
      where.branchId = branchFilter;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.sourceModule?.trim()) {
      where.sourceModule = query.sourceModule.trim();
    }
    if (query.sourceReference?.trim()) {
      where.sourceReference = query.sourceReference.trim();
    }
    if (query.startDate || query.endDate) {
      where.entryDate = {};
      if (query.startDate) {
        where.entryDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.entryDate.lte = new Date(query.endDate);
      }
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { entryNumber: { contains: term, mode: 'insensitive' } },
        { narration: { contains: term, mode: 'insensitive' } },
      ];
    }

    try {
      const [total, data] = await Promise.all([
        this.prisma.journalEntry.count({ where }),
        this.prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { entryDate: 'desc' },
          include: {
            branch: { select: { id: true, code: true, name: true } },
            createdBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true, type: true } },
              },
            },
          },
        }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Failed to list journal entries: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error retrieving journal entries.');
    }
  }

  /**
   * Find journal entry by ID
   */
  async findEntryById(user: AuthenticatedUser, id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with ID '${id}' was not found.`);
    }

    this.verifyBranchAccess(user, entry.branchId);

    return entry;
  }
}
