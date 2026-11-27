
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import type { LoanMetrics, LoanStatus } from '../finance-loan/FinanceLoan';
import './Dashboard.css';

type MetricCardProps = {
    label: string;
    value: string;
    note?: string;
    noteType?: 'danger' | 'success' | 'neutral';
};

function MetricCard({
    label,
    value,
    note,
    noteType = 'neutral',
}: MetricCardProps) {
    return (
        <article className="metric-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
            {note && (
                <div className={`metric-note ${noteType}`}>
                    {note}
                </div>
            )}
        </article>
    );
}

type ProgressRowProps = {
    label: string;
    value: string;
    percentage: number;
    color?: 'blue' | 'gold';
};

function ProgressRow({
    label,
    value,
    percentage,
    color = 'blue',
}: ProgressRowProps) {
    return (
        <div className="progress-row">
            <div className="progress-row-heading">
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
            <div className="progress-track">
                <div
                    className={`progress-fill ${color}`}
                    style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                />
            </div>
        </div>
    );
}

type PanelProps = {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
};

function Panel({ title, subtitle, children, className = '' }: PanelProps) {
    return (
        <section className={`dashboard-panel ${className}`}>
            <div className="panel-heading">
                <h2>{title}</h2>
                {subtitle && <span>{subtitle}</span>}
            </div>
            {children}
        </section>
    );
}

const LOAN_STATUS_CONFIG: Array<{ key: LoanStatus; label: string }> = [
    { key: 'ENQUIRY', label: 'Enquiry' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'UNDER_REVIEW', label: 'Under Review' },
    { key: 'SANCTIONED', label: 'Sanctioned' },
    { key: 'DISBURSED', label: 'Disbursed' },
    { key: 'REJECTED', label: 'Rejected' },
];

const exchangeStages = [
    { label: 'Inspection', value: 4, percentage: 52 },
    { label: 'Valuation', value: 4, percentage: 52 },
    { label: 'Approval', value: 1, percentage: 13 },
    { label: 'Purchased', value: 4, percentage: 52 },
    { label: 'Refurbishment', value: 0, percentage: 0 },
    { label: 'Listed for Resale', value: 2, percentage: 26 },
    { label: 'Resold', value: 7, percentage: 91 },
];

const departments = [
    { label: 'Executive', value: 5, percentage: 12 },
    { label: 'Sales', value: 40, percentage: 91 },
    { label: 'Finance', value: 10, percentage: 23 },
    { label: 'Service', value: 40, percentage: 91 },
    { label: 'Parts', value: 10, percentage: 23 },
    { label: 'HR', value: 5, percentage: 12 },
    { label: 'Ops', value: 20, percentage: 46 },
];

const notifications = [
    {
        icon: '🚨',
        message:
            'RC Book scan flagged a used-vehicle intake as High Risk — possible tampering',
        time: '12 min ago',
    },
    {
        icon: '💰',
        message: 'Receivables over 60 days increased to ₹18.4L',
        time: '38 min ago',
    },
    {
        icon: '☑️',
        message: 'TDS certificate generated and ready for download',
        time: '1 hr ago',
    },
    {
        icon: '🏢',
        message: 'New finance application sanctioned — awaiting disbursement',
        time: '2 hr ago',
    },
    {
        icon: '🧑‍💼',
        message: '3 employees pending leave approval this week',
        time: '3 hr ago',
    },
    {
        icon: '📄',
        message: 'GST 2A/2B reconciliation found 2 mismatched vendor invoices',
        time: '5 hr ago',
    },
];

function Dashboard() {
    const { selectedBranchId } = useAuth();
    const [loanMetrics, setLoanMetrics] = useState<LoanMetrics | null>(null);
    const [isLoadingLoans, setIsLoadingLoans] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchLoanMetrics = async () => {
            setIsLoadingLoans(true);
            try {
                const query =
                    selectedBranchId && selectedBranchId !== 'ALL'
                        ? `?branchId=${encodeURIComponent(selectedBranchId)}`
                        : '';
                const data = await apiRequest<LoanMetrics>(`/finance/loans/metrics${query}`);
                if (isMounted) {
                    setLoanMetrics(data);
                }
            } catch (err) {
                console.error('Failed to load loan metrics in dashboard:', err);
            } finally {
                if (isMounted) {
                    setIsLoadingLoans(false);
                }
            }
        };

        fetchLoanMetrics();
        return () => {
            isMounted = false;
        };
    }, [selectedBranchId]);

    const totalLoans = loanMetrics?.totalApplications ?? 0;
    const loanStatuses = LOAN_STATUS_CONFIG.map(({ key, label }) => {
        const count = loanMetrics?.byStatus?.[key]?.count ?? 0;
        const percentage = totalLoans > 0 ? Math.round((count / totalLoans) * 100) : 0;
        return {
            label,
            value: count,
            percentage,
        };
    });

    return (
        <div className="executive-dashboard">
            <div className="dashboard-title-row">
                <div>
                    <h1>Executive Dashboard</h1>
                    <p>
                        All branches · Finance, Accounts, HR &amp; Payroll and
                        Exchange/Used Vehicles — live snapshot as of 24 Aug 2026
                    </p>
                </div>

                <div className="dashboard-actions">
                    <button className="report-button" type="button">
                        Schedule Report
                    </button>
                    <button
                        className="copilot-button"
                        type="button"
                        title="Ask AI Copilot"
                        onClick={() => window.dispatchEvent(new Event("open-ai-copilot"))}
                    >
                        ✦ Ask AI Copilot
                    </button>
                </div>
            </div>

            <div className="metrics-grid">
                <MetricCard label="NET PROFIT (6 MO.)" value="₹42.86 L" />
                <MetricCard
                    label="RECEIVABLES OUTSTANDING"
                    value="₹74.36 L"
                    note="▼ ₹33.82 L overdue"
                    noteType="danger"
                />
                <MetricCard
                    label="PAYABLES OUTSTANDING"
                    value="₹93.58 L"
                    note="▼ ₹26.25 L overdue"
                    noteType="danger"
                />
                <MetricCard
                    label="ACTIVE LOAN APPLICATIONS"
                    value={loanMetrics ? String(loanMetrics.activeLoans) : (isLoadingLoans ? '...' : '0')}
                    note={
                        loanMetrics
                            ? `▲ ₹${(loanMetrics.totalCommissionEarned / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L commission earned`
                            : undefined
                    }
                    noteType="success"
                />
                <MetricCard
                    label="HR HEADCOUNT"
                    value="130"
                    note="= 3 on leave today"
                />
                <MetricCard
                    label="RC BOOK — HIGH RISK FLAGS"
                    value="0"
                    note="= 0/22 intakes scanned"
                />
            </div>

            <div className="aging-grid">
                <Panel
                    title="Receivables Aging"
                    subtitle="₹74.36 L total outstanding"
                >
                    <ProgressRow label="Current" value="₹33.40 L" percentage={74} />
                    <ProgressRow label="1-30 days" value="₹40.96 L" percentage={91} />
                    <ProgressRow label="31-60 days" value="₹0" percentage={0} />
                    <ProgressRow label="60+ days" value="₹0" percentage={0} />
                </Panel>

                <Panel
                    title="Payables Aging"
                    subtitle="₹93.58 L total outstanding"
                >
                    <ProgressRow
                        label="Not Yet Due"
                        value="₹67.33 L"
                        percentage={91}
                        color="gold"
                    />
                    <ProgressRow
                        label="1-30 days"
                        value="₹26.25 L"
                        percentage={35}
                        color="gold"
                    />
                    <ProgressRow
                        label="31-60 days"
                        value="₹0"
                        percentage={0}
                        color="gold"
                    />
                    <ProgressRow
                        label="60+ days"
                        value="₹0"
                        percentage={0}
                        color="gold"
                    />
                </Panel>
            </div>

            <div className="operations-grid">
                <Panel
                    title="Loan Applications by Status"
                    subtitle="Finance & Loan Desk"
                    className="loan-panel"
                >
                    {loanStatuses.map((item) => (
                        <ProgressRow
                            key={item.label}
                            label={item.label}
                            value={isLoadingLoans ? '...' : String(item.value)}
                            percentage={item.percentage}
                        />
                    ))}
                </Panel>

                <Panel
                    title="Exchange Pipeline by Stage"
                    subtitle="Used-vehicle intakes"
                    className="exchange-panel"
                >
                    {exchangeStages.map((item) => (
                        <ProgressRow
                            key={item.label}
                            label={item.label}
                            value={String(item.value)}
                            percentage={item.percentage}
                        />
                    ))}
                </Panel>
            </div>

            <div className="compliance-grid">
                <Panel
                    title="🔍 RC Book Authenticity Scanner"
                    subtitle="0/22 intakes scanned"
                    className="scanner-panel"
                >
                    <p className="scanner-description">
                        Forensic check on each used-vehicle intake's Registration
                        Certificate — font/format inconsistency, missing security
                        hologram, and chassis/engine alteration patterns.
                    </p>

                    <div className="risk-badges">
                        <span className="risk-badge genuine">● 0 Genuine</span>
                        <span className="risk-badge verification">
                            ● 0 Needs Verification
                        </span>
                        <span className="risk-badge high-risk">● 0 High Risk</span>
                        <span className="risk-badge unscanned">● 22 Not Scanned</span>
                    </div>

                    <p className="scanner-footnote">
                        Open <strong>Exchange / Used Vehicles</strong> to scan a new
                        intake or review a flagged record.
                    </p>
                </Panel>

                <Panel
                    title="TDS & TCS Compliance"
                    subtitle="36 entries on record"
                    className="tds-panel"
                >
                    <div className="compliance-item">
                        <span>📥</span>
                        <p>
                            <strong>Total TDS Deducted:</strong> ₹5.07 L
                        </p>
                    </div>
                    <div className="compliance-item">
                        <span>📤</span>
                        <p>
                            <strong>Total TCS Collected:</strong> ₹4.48 L
                        </p>
                    </div>
                    <div className="compliance-item">
                        <span>☑️</span>
                        <p>
                            <strong>Certificates Issued:</strong> 10
                        </p>
                    </div>
                    <div className="compliance-item">
                        <span>⌛</span>
                        <p>
                            <strong>Certificates Pending:</strong> 26
                        </p>
                    </div>
                </Panel>
            </div>

            <div className="bottom-grid">
                <Panel
                    title="Headcount by Department"
                    subtitle="HR & Payroll"
                >
                    {departments.map((item) => (
                        <ProgressRow
                            key={item.label}
                            label={item.label}
                            value={String(item.value)}
                            percentage={item.percentage}
                        />
                    ))}
                </Panel>

                <Panel
                    title="Notifications"
                    subtitle="6 recent"
                    className="notifications-panel"
                >
                    <div className="notification-list">
                        {notifications.map((item) => (
                            <div className="notification-item" key={item.message}>
                                <span className="notification-icon">{item.icon}</span>
                                <div>
                                    <p>{item.message}</p>
                                    <time>{item.time}</time>
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>


        </div>
    );
}

export default Dashboard;
