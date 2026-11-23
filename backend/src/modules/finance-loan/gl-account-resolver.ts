/**
 * ============================================================================
 * PROVISIONAL GENERAL LEDGER ACCOUNT RESOLVER
 * ============================================================================
 * IMPORTANT / CAUTION:
 * The account codes ('1150', '4300') and names resolved here are strictly
 * PROVISIONAL engineering placeholders. The dealership currently maintains its
 * official Chart of Accounts in Tally ERP without numeric codes.
 *
 * These accounts MUST be replaced, updated, or re-mapped once Finance confirms
 * the official Tally ledger names and codes.
 * ============================================================================
 */

import { BadRequestException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';

export const GL_PROVISIONAL_ACCOUNT_CODES = {
  // PROVISIONAL: Lender Commission Receivable (Asset, debit on disbursement)
  COMMISSION_RECEIVABLE: '1150',
  // PROVISIONAL: F&I Commission Revenue (Revenue, credit on disbursement)
  COMMISSION_REVENUE: '4300',
} as const;

export interface ResolvedDisbursementAccounts {
  receivableAccountId: string;
  revenueAccountId: string;
}

/**
 * Resolves an individual General Ledger account by code.
 * Ensures the account exists, is active, and is valid for the specified branch.
 */
export async function resolveAccountByCode(
  prismaOrTx: PrismaClient | Prisma.TransactionClient,
  code: string,
  branchId?: string,
): Promise<string> {
  const account = await prismaOrTx.account.findUnique({
    where: { code },
  });

  if (!account) {
    throw new BadRequestException(
      `GL Account with code '${code}' not found. Please ensure provisional accounts are seeded.`,
    );
  }

  if (!account.isActive) {
    throw new BadRequestException(
      `GL Account '${code}' (${account.name}) is inactive.`,
    );
  }

  if (account.branchId && branchId && account.branchId !== branchId) {
    throw new BadRequestException(
      `GL Account '${code}' belongs to branch '${account.branchId}' and cannot be used in branch '${branchId}'.`,
    );
  }

  return account.id;
}

/**
 * Resolves both required accounts for loan disbursement journal posting:
 * 1. Commission Receivable (Code 1150 - ASSET)
 * 2. Commission Revenue (Code 4300 - REVENUE)
 */
export async function resolveDisbursementAccounts(
  prismaOrTx: PrismaClient | Prisma.TransactionClient,
  branchId: string,
): Promise<ResolvedDisbursementAccounts> {
  const receivableAccountId = await resolveAccountByCode(
    prismaOrTx,
    GL_PROVISIONAL_ACCOUNT_CODES.COMMISSION_RECEIVABLE,
    branchId,
  );

  const revenueAccountId = await resolveAccountByCode(
    prismaOrTx,
    GL_PROVISIONAL_ACCOUNT_CODES.COMMISSION_REVENUE,
    branchId,
  );

  return {
    receivableAccountId,
    revenueAccountId,
  };
}
