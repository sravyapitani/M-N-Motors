import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
    shouldShowPayoutAlertsToast,
    markPayoutAlertsToastShown,
    spawnPayoutAlertsToast,
    shouldShowFundingAlertsToast,
    markFundingAlertsToastShown,
    spawnFundingAlertsToast,
} from './payout-alerts-toast';
import './PayoutAlertsBell.css';

const AUTHORIZED_ROLES = [
    'SYSTEM_ADMIN',
    'FINANCE_MANAGER',
    'FINANCE_EXECUTIVE',
    'BRANCH_HEAD',
    'LOAN_OFFICER',
];

export interface PayoutAlert {
    payoutId: string;
    loanId: string;
    customerName: string;
    branchId: string;
    branchCode?: string;
    branchName?: string;
    lenderId?: string | null;
    lenderName: string;
    kind: 'LOAN_AMOUNT' | 'COMMISSION';
    typeLabel: string;
    expectedAmount: number;
    receivedAmount: number;
    outstandingAmount: number;
    expectedDate: string;
    dateEstimated: boolean;
    alertType: 'DUE_SOON' | 'OVERDUE' | 'DATE_TO_CONFIRM';
    urgencyLabel: string;
    daysDifference: number;
}

interface AlertsApiResponse {
    summary: {
        totalAlerts: number;
        dueSoonCount: number;
        overdueCount: number;
        dateToConfirmCount: number;
        totalOutstandingAlertAmount: number;
    };
    alerts: PayoutAlert[];
}

export interface FundingAlert {
    drawId: string;
    facilityId: string;
    facilityKey: string;
    bankName: string;
    productCode: string;
    amount: number;
    outstanding: number;
    drawDate: string;
    dueDate: string;
    daysLeft: number;
    level: string;
    levelLabel: string;
    isOverdue: boolean;
}

interface FundingAlertsResponse {
    alerts: FundingAlert[];
    summary: {
        totalAlerts: number;
        overdueCount: number;
        dueSoonCount: number;
    };
}

let cachedAlertsCount = 0;
const countListeners = new Set<(count: number) => void>();

function setGlobalAlertsCount(count: number) {
    cachedAlertsCount = count;
    countListeners.forEach((fn) => fn(count));
}

/**
 * Hook to get the current payout and funding alerts count for the header bell red dot.
 */
export function usePayoutAlertsCount(): number {
    const { user } = useAuth();
    const [count, setCount] = useState<number>(cachedAlertsCount);

    const isAuthorized = Boolean(
        user?.roles?.some((r) => AUTHORIZED_ROLES.includes(r)),
    );
    const hasCcView = Boolean(
        user?.roles?.includes('SYSTEM_ADMIN') || user?.permissions?.includes('CC_VIEW'),
    );

    useEffect(() => {
        if (!isAuthorized && !hasCcView) {
            return;
        }

        const listener = (newCount: number) => setCount(newCount);
        countListeners.add(listener);

        // Fetch count on initial page load
        const loadAlerts = async () => {
            let total = 0;

            if (isAuthorized) {
                try {
                    const res = await apiRequest<AlertsApiResponse>('/finance/payouts/alerts');
                    total += res?.summary?.totalAlerts ?? 0;
                    const items = res?.alerts ?? [];
                    if (shouldShowPayoutAlertsToast(items)) {
                        markPayoutAlertsToastShown(items);
                        const overdue =
                            res?.summary?.overdueCount ??
                            items.filter((a) => a.alertType === 'OVERDUE').length;
                        const dueSoon =
                            res?.summary?.dueSoonCount ??
                            items.filter((a) => a.alertType === 'DUE_SOON').length;
                        if (overdue > 0 || dueSoon > 0) {
                            spawnPayoutAlertsToast(overdue, dueSoon, items[0]?.payoutId);
                        }
                    }
                } catch {
                    // Ignore errors / 403 silently
                }
            }

            if (hasCcView) {
                try {
                    const fRes = await apiRequest<FundingAlertsResponse>('/finance/funding/alerts');
                    total += fRes?.summary?.totalAlerts ?? 0;
                    const fItems = fRes?.alerts ?? [];
                    if (shouldShowFundingAlertsToast(fItems)) {
                        markFundingAlertsToastShown(fItems);
                        const overdue =
                            fRes?.summary?.overdueCount ??
                            fItems.filter((a) => a.isOverdue).length;
                        const dueSoon =
                            fRes?.summary?.dueSoonCount ??
                            fItems.filter((a) => !a.isOverdue).length;
                        if (overdue > 0 || dueSoon > 0) {
                            spawnFundingAlertsToast(overdue, dueSoon, fItems[0]?.drawId);
                        }
                    }
                } catch {
                    // Ignore errors / 403 silently
                }
            }

            setGlobalAlertsCount(total);
        };

        loadAlerts();

        return () => {
            countListeners.delete(listener);
        };
    }, [isAuthorized, hasCcView]);

    return isAuthorized || hasCcView ? count : 0;
}

interface PayoutAlertsBellProps {
    isOpen?: boolean;
}

/**
 * Payout and Funding alerts section rendered inside the notification panel.
 */
export function PayoutAlertsBell({ isOpen }: PayoutAlertsBellProps) {
    const { user, selectedBranchId } = useAuth();
    const [alerts, setAlerts] = useState<PayoutAlert[]>([]);
    const [fundingAlerts, setFundingAlerts] = useState<FundingAlert[]>([]);
    const [hasLoaded, setHasLoaded] = useState(false);

    const isAuthorized = Boolean(
        user?.roles?.some((r) => AUTHORIZED_ROLES.includes(r)),
    );
    const hasCcView = Boolean(
        user?.roles?.includes('SYSTEM_ADMIN') || user?.permissions?.includes('CC_VIEW'),
    );

    const fetchAlerts = useCallback(async () => {
        if (!isAuthorized && !hasCcView) return;

        let total = 0;
        let pItems: PayoutAlert[] = [];
        let fItems: FundingAlert[] = [];

        if (isAuthorized) {
            try {
                const query =
                    selectedBranchId && selectedBranchId !== 'ALL'
                        ? `?branchId=${encodeURIComponent(selectedBranchId)}`
                        : '';
                const res = await apiRequest<AlertsApiResponse>(
                    `/finance/payouts/alerts${query}`,
                );
                pItems = res?.alerts ?? [];
                total += res?.summary?.totalAlerts ?? pItems.length;

                if (shouldShowPayoutAlertsToast(pItems)) {
                    markPayoutAlertsToastShown(pItems);
                    const overdue =
                        res?.summary?.overdueCount ??
                        pItems.filter((a) => a.alertType === 'OVERDUE').length;
                    const dueSoon =
                        res?.summary?.dueSoonCount ??
                        pItems.filter((a) => a.alertType === 'DUE_SOON').length;
                    if (overdue > 0 || dueSoon > 0) {
                        spawnPayoutAlertsToast(overdue, dueSoon, pItems[0]?.payoutId);
                    }
                }
            } catch {
                pItems = [];
            }
        }

        if (hasCcView) {
            try {
                const fRes = await apiRequest<FundingAlertsResponse>('/finance/funding/alerts');
                fItems = fRes?.alerts ?? [];
                total += fRes?.summary?.totalAlerts ?? fItems.length;

                if (shouldShowFundingAlertsToast(fItems)) {
                    markFundingAlertsToastShown(fItems);
                    const overdue =
                        fRes?.summary?.overdueCount ??
                        fItems.filter((a) => a.isOverdue).length;
                    const dueSoon =
                        fRes?.summary?.dueSoonCount ??
                        fItems.filter((a) => !a.isOverdue).length;
                    if (overdue > 0 || dueSoon > 0) {
                        spawnFundingAlertsToast(overdue, dueSoon, fItems[0]?.drawId);
                    }
                }
            } catch {
                fItems = [];
            }
        }

        setAlerts(pItems);
        setFundingAlerts(fItems);
        setGlobalAlertsCount(total);
        setHasLoaded(true);
    }, [isAuthorized, hasCcView, selectedBranchId]);

    // Fetch on mount
    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // Re-fetch whenever bell dropdown is opened
    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
        }
    }, [isOpen, fetchAlerts]);

    if ((!isAuthorized && !hasCcView) || !hasLoaded || (alerts.length === 0 && fundingAlerts.length === 0)) {
        return null;
    }

    return (
        <div className="payout-alerts-bell-section">
            {/* Payout Alerts List */}
            {alerts.length > 0 && (
                <>
                    <div className="payout-alerts-bell-header">
                        <span>PAYOUT ALERTS</span>
                        <span className="payout-badge-count">{alerts.length}</span>
                    </div>
                    {alerts.map((alert) => {
                        const icon =
                            alert.alertType === 'OVERDUE'
                                ? '🚨'
                                : alert.alertType === 'DUE_SOON'
                                ? '⏰'
                                : '📅';
                        const kindClass = `alert-${alert.alertType
                            .toLowerCase()
                            .replace(/_/g, '-')}`;

                        const payoutUrl = `/finance-loan?tab=payouts&payoutId=${encodeURIComponent(alert.payoutId)}`;
                        return (
                            <a
                                key={alert.payoutId}
                                href={payoutUrl}
                                onClick={(e) => {
                                    if (window.location.pathname === '/finance-loan') {
                                        e.preventDefault();
                                        window.history.pushState({}, '', payoutUrl);
                                        window.dispatchEvent(new CustomEvent('nexus:navigate-tab', { detail: { search: `?tab=payouts&payoutId=${encodeURIComponent(alert.payoutId)}` } }));
                                        window.dispatchEvent(new PopStateEvent('popstate'));
                                    }
                                }}
                                className={`payout-alert-link ${kindClass}`}
                            >
                                <span className="payout-alert-icon-box">{icon}</span>
                                <div className="payout-alert-body">
                                    <div className="payout-alert-header-line">
                                        <span className="payout-alert-urgency-tag">
                                            {alert.urgencyLabel}
                                        </span>
                                        <span className="payout-alert-type-tag">
                                            {alert.typeLabel}
                                        </span>
                                    </div>
                                    <p className="payout-alert-customer-line">
                                        {alert.customerName}{' '}
                                        {alert.branchCode ? `(${alert.branchCode})` : ''} •{' '}
                                        {alert.lenderName}
                                    </p>
                                    <p className="payout-alert-amount-line">
                                        Outstanding:{' '}
                                        <strong>
                                            ₹{Math.round(alert.outstandingAmount).toLocaleString('en-IN')}
                                        </strong>
                                    </p>
                                </div>
                            </a>
                        );
                    })}
                </>
            )}

            {/* CC / Funding Alerts List */}
            {fundingAlerts.length > 0 && (
                <>
                    <div className="payout-alerts-bell-header" style={{ marginTop: alerts.length > 0 ? '12px' : 0 }}>
                        <span>CC / FUNDING ALERTS</span>
                        <span className="payout-badge-count">{fundingAlerts.length}</span>
                    </div>
                    {fundingAlerts.map((fAlert) => {
                        const icon = fAlert.isOverdue ? '🚨' : '💳';
                        const kindClass = fAlert.isOverdue ? 'alert-overdue' : 'alert-due-soon';

                        const fundingUrl = `/finance-loan?tab=funding&drawId=${encodeURIComponent(fAlert.drawId)}`;
                        return (
                            <a
                                key={fAlert.drawId}
                                href={fundingUrl}
                                onClick={(e) => {
                                    if (window.location.pathname === '/finance-loan') {
                                        e.preventDefault();
                                        window.history.pushState({}, '', fundingUrl);
                                        window.dispatchEvent(new CustomEvent('nexus:navigate-tab', { detail: { search: `?tab=funding&drawId=${encodeURIComponent(fAlert.drawId)}` } }));
                                        window.dispatchEvent(new PopStateEvent('popstate'));
                                    }
                                }}
                                className={`payout-alert-link ${kindClass}`}
                            >
                                <span className="payout-alert-icon-box">{icon}</span>
                                <div className="payout-alert-body">
                                    <div className="payout-alert-header-line">
                                        <span className="payout-alert-urgency-tag">
                                            {fAlert.levelLabel}
                                        </span>
                                        <span className="payout-alert-type-tag">
                                            {fAlert.productCode}
                                        </span>
                                    </div>
                                    <p className="payout-alert-customer-line">
                                        {fAlert.bankName} ({fAlert.facilityKey})
                                    </p>
                                    <p className="payout-alert-amount-line">
                                        Outstanding:{' '}
                                        <strong>
                                            ₹{Math.round(fAlert.outstanding).toLocaleString('en-IN')}
                                        </strong>{' '}
                                        • Due {fAlert.dueDate}
                                    </p>
                                </div>
                            </a>
                        );
                    })}
                </>
            )}
        </div>
    );
}
