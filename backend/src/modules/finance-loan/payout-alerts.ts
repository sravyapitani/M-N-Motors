/**
 * Financer Payout Alerts Classification Logic
 * Pure helper functions for classifying payouts by Asia/Kolkata (IST) calendar dates.
 */

export type PayoutAlertKind = 'LOAN_AMOUNT' | 'COMMISSION';
export type PayoutAlertType = 'DUE_SOON' | 'OVERDUE' | 'DATE_TO_CONFIRM';

export interface PayoutAlertInput {
  payoutId: string;
  loanId: string;
  customerName: string;
  branchId: string;
  branchCode?: string;
  branchName?: string;
  lenderId?: string | null;
  lenderName: string;
  kind: PayoutAlertKind;
  expectedAmount: number;
  receivedAmount: number;
  expectedDate: Date | string;
  dateEstimated: boolean;
  status?: string;
}

export interface PayoutAlertItem {
  payoutId: string;
  loanId: string;
  customerName: string;
  branchId: string;
  branchCode?: string;
  branchName?: string;
  lenderId?: string | null;
  lenderName: string;
  kind: PayoutAlertKind;
  typeLabel: string;
  expectedAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  expectedDate: string;
  dateEstimated: boolean;
  alertType: PayoutAlertType;
  urgencyLabel: string;
  daysDifference: number;
}

/**
 * Returns the calendar year, month (0-indexed), day, and YYYY-MM-DD string in Asia/Kolkata timezone.
 * Asia/Kolkata is UTC+05:30 (+330 minutes).
 */
export function getKolkataCalendarDate(d: Date | string): {
  year: number;
  month: number;
  day: number;
  dateStr: string;
} {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const kolkataTime = new Date(dateObj.getTime() + KOLKATA_OFFSET_MS);

  const year = kolkataTime.getUTCFullYear();
  const month = kolkataTime.getUTCMonth();
  const day = kolkataTime.getUTCDate();
  const monthStr = String(month + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');

  return {
    year,
    month,
    day,
    dateStr: `${year}-${monthStr}-${dayStr}`,
  };
}

/**
 * Computes difference in calendar days between targetDate and referenceNow in Asia/Kolkata timezone.
 * Returns > 0 if targetDate is in the future, 0 if same Kolkata calendar day, < 0 if in the past.
 */
export function diffCalendarDaysKolkata(
  targetDate: Date | string,
  referenceNow: Date | string = new Date(),
): number {
  const target = getKolkataCalendarDate(targetDate);
  const ref = getKolkataCalendarDate(referenceNow);

  const utcTarget = Date.UTC(target.year, target.month, target.day);
  const utcRef = Date.UTC(ref.year, ref.month, ref.day);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  return Math.round((utcTarget - utcRef) / MS_PER_DAY);
}

/**
 * Classifies a payout alert according to business requirements:
 * - DUE SOON: expectedDate is today (0) or tomorrow (+1) in Kolkata time, outstanding > 0.
 * - OVERDUE: expectedDate < today (< 0) in Kolkata time, outstanding > 0, dateEstimated = false.
 * - DATE TO CONFIRM: expectedDate < today (< 0), outstanding > 0, dateEstimated = true.
 * - null: outstanding <= 0, or expectedDate >= 2 days away.
 */
export function classifyPayoutAlert(
  payout: PayoutAlertInput,
  referenceNow: Date | string = new Date(),
): PayoutAlertItem | null {
  const outstanding = Math.round((payout.expectedAmount - payout.receivedAmount) * 100) / 100;
  if (outstanding <= 0 || payout.status === 'RECEIVED') {
    return null;
  }

  const daysDiff = diffCalendarDaysKolkata(payout.expectedDate, referenceNow);
  const typeLabel = payout.kind === 'LOAN_AMOUNT' ? 'DO amount' : 'Commission';
  const expectedDateIso = (typeof payout.expectedDate === 'string'
    ? new Date(payout.expectedDate)
    : payout.expectedDate
  ).toISOString();

  // 1. DUE SOON: today (0) or tomorrow (+1)
  if (daysDiff === 0 || daysDiff === 1) {
    return {
      payoutId: payout.payoutId,
      loanId: payout.loanId,
      customerName: payout.customerName,
      branchId: payout.branchId,
      branchCode: payout.branchCode,
      branchName: payout.branchName,
      lenderId: payout.lenderId,
      lenderName: payout.lenderName,
      kind: payout.kind,
      typeLabel,
      expectedAmount: payout.expectedAmount,
      receivedAmount: payout.receivedAmount,
      outstandingAmount: outstanding,
      expectedDate: expectedDateIso,
      dateEstimated: payout.dateEstimated,
      alertType: 'DUE_SOON',
      urgencyLabel: daysDiff === 0 ? 'Due today' : 'Due tomorrow',
      daysDifference: daysDiff,
    };
  }

  // 2. In the past (daysDiff < 0)
  if (daysDiff < 0) {
    const daysOverdue = Math.abs(daysDiff);

    // dateEstimated = true must NOT show as overdue -> "Date to confirm"
    if (payout.dateEstimated) {
      return {
        payoutId: payout.payoutId,
        loanId: payout.loanId,
        customerName: payout.customerName,
        branchId: payout.branchId,
        branchCode: payout.branchCode,
        branchName: payout.branchName,
        lenderId: payout.lenderId,
        lenderName: payout.lenderName,
        kind: payout.kind,
        typeLabel,
        expectedAmount: payout.expectedAmount,
        receivedAmount: payout.receivedAmount,
        outstandingAmount: outstanding,
        expectedDate: expectedDateIso,
        dateEstimated: true,
        alertType: 'DATE_TO_CONFIRM',
        urgencyLabel: 'Date to confirm',
        daysDifference: daysDiff,
      };
    }

    return {
      payoutId: payout.payoutId,
      loanId: payout.loanId,
      customerName: payout.customerName,
      branchId: payout.branchId,
      branchCode: payout.branchCode,
      branchName: payout.branchName,
      lenderId: payout.lenderId,
      lenderName: payout.lenderName,
      kind: payout.kind,
      typeLabel,
      expectedAmount: payout.expectedAmount,
      receivedAmount: payout.receivedAmount,
      outstandingAmount: outstanding,
      expectedDate: expectedDateIso,
      dateEstimated: false,
      alertType: 'OVERDUE',
      urgencyLabel: daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`,
      daysDifference: daysDiff,
    };
  }

  // daysDiff >= 2 -> Not an alert yet
  return null;
}
