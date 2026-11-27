// PROVISIONAL: confirm with Sir
export const LOAN_AMOUNT_PAYOUT_DAYS = 2;
// PROVISIONAL: confirm with Sir
export const COMMISSION_PAYOUT_DAYS = 60;
export const DEFAULT_PAYOUT_DAYS = COMMISSION_PAYOUT_DAYS;

export type PayoutStatus = 'PENDING' | 'PARTIAL' | 'RECEIVED' | 'OVERDUE';

export interface PayoutCalculationInput {
    expectedAmount: number | string | { toString(): string };
    receivedAmount: number | string | { toString(): string };
    expectedDate: Date | string;
    dateEstimated: boolean;
    today?: Date | string;
}

export interface PayoutCalculationResult {
    expectedCents: number;
    receivedCents: number;
    outstandingCents: number;
    expectedAmount: number;
    receivedAmount: number;
    outstandingAmount: number;
    status: PayoutStatus;
    daysOverdue: number;
    isOverdue: boolean;
}

/**
 * Converts a decimal or number string into integer cents (paise) to eliminate floating-point drift.
 */
export function toCents(amount: number | string | { toString(): string }): number {
    const num = typeof amount === 'number'
        ? amount
        : parseFloat(amount?.toString ? amount.toString() : String(amount));
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
}

/**
 * Converts integer cents back to standard currency amount with 2 decimal places.
 */
export function fromCents(cents: number): number {
    return Math.round(cents) / 100;
}

/**
 * Calculates expected payout date based on start date, payout kind, and optional lender overrides.
 * PROVISIONAL: confirm with Sir
 */
export function computeExpectedDate(
    startDate: Date | string,
    kind: 'LOAN_AMOUNT' | 'COMMISSION' = 'COMMISSION',
    lender?: { payoutDays?: number | null; commissionPayoutDays?: number | null } | null,
): Date {
    const d = new Date(startDate);
    // PROVISIONAL: confirm with Sir
    let days: number;
    if (kind === 'LOAN_AMOUNT') {
        days = typeof lender?.payoutDays === 'number' && !isNaN(lender.payoutDays) && lender.payoutDays > 0
            ? lender.payoutDays
            : LOAN_AMOUNT_PAYOUT_DAYS;
    } else {
        days = typeof lender?.commissionPayoutDays === 'number' && !isNaN(lender.commissionPayoutDays) && lender.commissionPayoutDays > 0
            ? lender.commissionPayoutDays
            : COMMISSION_PAYOUT_DAYS;
    }
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Computes PENDING, PARTIAL, RECEIVED, or OVERDUE status along with daysOverdue and integer-cents arithmetic.
 * Payouts with dateEstimated = true are NOT counted as overdue.
 * PROVISIONAL: confirm with Sir
 */
export function computePayoutStatus(input: PayoutCalculationInput): PayoutCalculationResult {
    const expectedCents = toCents(input.expectedAmount);
    const receivedCents = toCents(input.receivedAmount);
    const outstandingCents = Math.max(0, expectedCents - receivedCents);

    const expectedDate = new Date(input.expectedDate);
    const today = input.today ? new Date(input.today) : new Date();

    // Start-of-day comparison for overdue
    const expectedMidnight = new Date(expectedDate.getFullYear(), expectedDate.getMonth(), expectedDate.getDate()).getTime();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const diffMs = todayMidnight - expectedMidnight;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const daysOverdue = diffDays > 0 ? diffDays : 0;

    let status: PayoutStatus;

    if (receivedCents >= expectedCents && expectedCents > 0) {
        status = 'RECEIVED';
    } else if (receivedCents > 0) {
        status = 'PARTIAL';
    } else if (daysOverdue > 0 && !input.dateEstimated && outstandingCents > 0) {
        status = 'OVERDUE';
    } else {
        status = 'PENDING';
    }

    const isOverdue = status === 'OVERDUE';

    return {
        expectedCents,
        receivedCents,
        outstandingCents,
        expectedAmount: fromCents(expectedCents),
        receivedAmount: fromCents(receivedCents),
        outstandingAmount: fromCents(outstandingCents),
        status,
        daysOverdue: !input.dateEstimated ? daysOverdue : 0,
        isOverdue,
    };
}
