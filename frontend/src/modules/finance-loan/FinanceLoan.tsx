/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { FundingTab } from './FundingTab';
import './FinanceLoan.css';

export type LoanStatus =
    | 'ENQUIRY'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'SANCTIONED'
    | 'DISBURSED'
    | 'REJECTED';

export interface BranchData {
    id: string;
    code: string;
    name: string;
}

export interface SubmittingUserData {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export interface LenderRecord {
    id: string;
    name: string;
    tallyLedgerName: string;
    type: 'BANK' | 'NBFC' | 'INSURANCE' | 'OTHER';
    isActive: boolean;
}

export interface LoanApplicationRecord {
    id: string;
    customerName: string;
    lenderName: string;
    lenderId?: string | null;
    lender?: {
        id: string;
        name: string;
        type: string;
    } | null;
    loanAmount: string | number;
    interestRate: string | number;
    tenureMonths: number;
    commissionAmount: string | number;
    status: LoanStatus;
    submittedAt?: string | null;
    underReviewAt?: string | null;
    sanctionedAt?: string | null;
    disbursedAt?: string | null;
    rejectedAt?: string | null;
    branchId: string;
    submittingUserId: string;
    createdAt: string;
    updatedAt: string;
    branch?: BranchData;
    submittingUser?: SubmittingUserData;
}

export interface LoanMetrics {
    totalApplications: number;
    activeLoans: number;
    disbursedCount: number;
    totalDisbursedAmount: number;
    totalCommissionEarned: number;
    byStatus: Record<string, { count: number; totalAmount: number }>;
    byLender: Array<{
        id?: string;
        name: string;
        count: number;
        totalAmount: number;
        commission: number;
        disbursedCount?: number;
        disbursedAmount?: number;
        pendingCount?: number;
        pendingAmount?: number;
        enquiryCount?: number;
        enquiryAmount?: number;
        rejectedCount?: number;
        rejectedAmount?: number;
    }>;
}

interface PaginatedLoansResponse {
    data: LoanApplicationRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const statusLabels: Record<LoanStatus, string> = {
    ENQUIRY: 'Enquiry',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    SANCTIONED: 'Sanctioned',
    DISBURSED: 'Disbursed',
    REJECTED: 'Rejected',
};

const ALLOWED_STATUS_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
    ENQUIRY: ['SUBMITTED', 'REJECTED'],
    SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
    UNDER_REVIEW: ['SANCTIONED', 'REJECTED'],
    SANCTIONED: ['DISBURSED', 'REJECTED'],
    DISBURSED: [],
    REJECTED: ['ENQUIRY', 'SUBMITTED'],
};

interface BankCardItem {
    key: string;
    name: string;
    tallyLedgerName?: string;
    type: string;
    lenderType: 'BANK' | 'NBFC' | 'OTHER' | 'INSURANCE';
    icon: string;
    isActive: boolean;
    metric?: {
        name: string;
        count: number;
        totalAmount: number;
        commission: number;
        disbursedCount?: number;
        disbursedAmount?: number;
        pendingCount?: number;
        pendingAmount?: number;
        enquiryCount?: number;
        enquiryAmount?: number;
        rejectedCount?: number;
        rejectedAmount?: number;
    };
    isCustom?: boolean;
}

const formatINR = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '₹0';
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num)}`;
};

const formatCurrencyCompact = (value: number) => {
    if (value >= 10000000) {
        return `₹${(value / 10000000).toFixed(2)} Cr`;
    }
    if (value >= 100000) {
        return `₹${(value / 100000).toFixed(2)} L`;
    }
    return formatINR(value);
};

function StatusBadge({ status }: { status: LoanStatus }) {
    const label = statusLabels[status] || status;
    const cssModifier = status.toLowerCase().replaceAll('_', '-');
    return (
        <span className={`loan-status status-${cssModifier}`}>
            <span className="status-dot" />
            {label}
        </span>
    );
}

interface FinanceApplicationModalProps {
    onClose: () => void;
    onSuccess: (loan: LoanApplicationRecord) => void;
    lenders: LenderRecord[];
}

function FinanceApplicationModal({
    onClose,
    onSuccess,
    lenders,
}: FinanceApplicationModalProps) {
    const { user, selectedBranchId } = useAuth();

    const [customerName, setCustomerName] = useState('');
    const [selectedLenderValue, setSelectedLenderValue] = useState(() =>
        lenders.length > 0 ? lenders[0].id : 'Other',
    );
    const [customLender, setCustomLender] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [interestRate, setInterestRate] = useState('9.5');
    const [tenureMonths, setTenureMonths] = useState('48');
    const [isCustomTenure, setIsCustomTenure] = useState(false);
    const [commissionAmount, setCommissionAmount] = useState('');

    const defaultBranchId =
        user?.branches && user.branches.length > 0
            ? (selectedBranchId && selectedBranchId !== 'ALL' && user.branches.some((b) => b.id === selectedBranchId)
                ? selectedBranchId
                : user.branches[0].id)
            : '';

    const [branchId, setBranchId] = useState(defaultBranchId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);

        const amount = parseFloat(loanAmount);
        const rate = parseFloat(interestRate);
        const tenure = parseInt(tenureMonths, 10);

        let finalLenderName: string;
        let finalLenderId: string | undefined = undefined;

        if (selectedLenderValue === 'Other') {
            finalLenderName = customLender.trim();
        } else {
            const found = lenders.find((l) => l.id === selectedLenderValue);
            if (found) {
                finalLenderId = found.id;
                finalLenderName = found.name;
            } else {
                finalLenderName = selectedLenderValue;
            }
        }

        if (!customerName.trim()) {
            setErrorMessage('Customer name is required.');
            return;
        }

        if (!finalLenderName) {
            setErrorMessage('Lender name is required.');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            setErrorMessage('Loan amount must be greater than zero.');
            return;
        }

        if (isNaN(rate) || rate < 0 || rate > 100) {
            setErrorMessage('Interest rate must be between 0% and 100%.');
            return;
        }

        if (isNaN(tenure) || tenure < 1 || tenure > 360) {
            setErrorMessage('Tenure must be between 1 and 360 months.');
            return;
        }

        if (!branchId) {
            setErrorMessage('A valid dealership branch is required.');
            return;
        }

        const payload: Record<string, unknown> = {
            customerName: customerName.trim(),
            loanAmount: amount,
            interestRate: rate,
            tenureMonths: tenure,
            branchId: branchId.trim(),
        };

        if (finalLenderId) {
            payload.lenderId = finalLenderId;
            payload.lenderName = finalLenderName;
        } else {
            payload.lenderName = finalLenderName;
        }

        if (commissionAmount.trim()) {
            const comm = parseFloat(commissionAmount);
            if (!isNaN(comm) && comm >= 0) {
                payload.commissionAmount = comm;
            } else {
                payload.commissionAmount = 0;
            }
        } else {
            payload.commissionAmount = 0;
        }

        setIsSubmitting(true);
        try {
            const created = await apiRequest<LoanApplicationRecord>('/finance/loans', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            onSuccess(created);
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                setErrorMessage(err.message);
            } else if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('Failed to submit loan application.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="loan-modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSubmitting) onClose();
            }}
        >
            <section
                className="loan-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="loan-modal-title"
            >
                <div className="loan-modal-heading">
                    <div>
                        <h2 id="loan-modal-title">New Finance Application</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                            Submit file to lending institution pipeline
                        </p>
                    </div>
                    <button
                        className="loan-modal-close"
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Close dialog"
                    >
                        ×
                    </button>
                </div>

                {errorMessage && (
                    <div className="loan-modal-error" role="alert">
                        <strong>Submission Error: </strong>
                        {errorMessage}
                    </div>
                )}

                <form className="loan-application-form" onSubmit={handleSubmit}>
                    <label>
                        Customer Name *
                        <input
                            required
                            value={customerName}
                            onChange={(event) => setCustomerName(event.target.value)}
                            placeholder="Enter customer full name"
                            disabled={isSubmitting}
                        />
                    </label>

                    <label>
                        Lender Partner *
                        <select
                            value={selectedLenderValue}
                            onChange={(event) => setSelectedLenderValue(event.target.value)}
                            disabled={isSubmitting}
                        >
                            {lenders.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                            <option value="Other">Other (Custom Lender)</option>
                        </select>
                    </label>

                    {selectedLenderValue === 'Other' && (
                        <label>
                            Custom Lender Name *
                            <input
                                required
                                value={customLender}
                                onChange={(event) => setCustomLender(event.target.value)}
                                placeholder="Enter lender bank / NBFC name"
                                disabled={isSubmitting}
                            />
                        </label>
                    )}

                    <label>
                        Dealership Branch *
                        {user?.branches && user.branches.length > 0 ? (
                            <select
                                value={branchId}
                                onChange={(event) => setBranchId(event.target.value)}
                                disabled={isSubmitting || user.branches.length <= 1}
                            >
                                {user.branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                required
                                value={branchId}
                                onChange={(event) => setBranchId(event.target.value)}
                                placeholder="Branch ID"
                                disabled={isSubmitting}
                            />
                        )}
                    </label>

                    <label>
                        Loan Amount (₹) *
                        <input
                            required
                            type="number"
                            min="1"
                            step="any"
                            value={loanAmount}
                            onChange={(event) => setLoanAmount(event.target.value)}
                            placeholder="e.g. 750000"
                            disabled={isSubmitting}
                        />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <label>
                            Interest Rate (% p.a.) *
                            <input
                                required
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={interestRate}
                                onChange={(event) => setInterestRate(event.target.value)}
                                placeholder="9.5"
                                disabled={isSubmitting}
                            />
                        </label>

                        <label>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Tenure (months) *</span>
                                <button
                                    type="button"
                                    onClick={() => setIsCustomTenure((prev) => !prev)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#1e4fa8',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        padding: '0 2px',
                                        textDecoration: 'underline',
                                    }}
                                    disabled={isSubmitting}
                                >
                                    {isCustomTenure ? '← Presets' : '+ Custom'}
                                </button>
                            </div>
                            {isCustomTenure ? (
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    max="360"
                                    value={tenureMonths}
                                    onChange={(event) => setTenureMonths(event.target.value)}
                                    placeholder="Enter tenure in months (e.g. 96)"
                                    disabled={isSubmitting}
                                    autoFocus
                                />
                            ) : (
                                <select
                                    value={['12', '24', '36', '48', '60', '84'].includes(tenureMonths) ? tenureMonths : 'custom'}
                                    onChange={(event) => {
                                        if (event.target.value === 'custom') {
                                            setIsCustomTenure(true);
                                        } else {
                                            setTenureMonths(event.target.value);
                                        }
                                    }}
                                    disabled={isSubmitting}
                                >
                                    <option value="12">12 months (1 yr)</option>
                                    <option value="24">24 months (2 yrs)</option>
                                    <option value="36">36 months (3 yrs)</option>
                                    <option value="48">48 months (4 yrs)</option>
                                    <option value="60">60 months (5 yrs)</option>
                                    <option value="84">84 months (7 yrs)</option>
                                    <option value="custom">Custom tenure (enter months)...</option>
                                </select>
                            )}
                            {isCustomTenure && tenureMonths && !isNaN(parseInt(tenureMonths, 10)) && parseInt(tenureMonths, 10) > 0 && (
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>
                                    ≈ {(parseInt(tenureMonths, 10) / 12).toFixed(1)} years ({parseInt(tenureMonths, 10)} months)
                                </span>
                            )}
                        </label>
                    </div>

                    <label>
                        Commission Amount (₹)
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={commissionAmount}
                            onChange={(event) => setCommissionAmount(event.target.value)}
                            placeholder="Enter commission amount (₹)"
                            disabled={isSubmitting}
                        />
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Variable commission amount. Enter any amount you want.
                        </span>
                    </label>

                    <div className="loan-modal-actions">
                        <button
                            className="loan-button-secondary"
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            className="loan-button-primary"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

interface EditLoanModalProps {
    application: LoanApplicationRecord;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updated: LoanApplicationRecord) => void;
    lenders: LenderRecord[];
}

function EditLoanModal({
    application,
    isOpen,
    onClose,
    onSuccess,
    lenders,
}: EditLoanModalProps) {
    const { user } = useAuth();
    const [customerName, setCustomerName] = useState(application.customerName);
    const [selectedLenderValue, setSelectedLenderValue] = useState(() => {
        if (application.lenderId && lenders.some((l) => l.id === application.lenderId)) {
            return application.lenderId;
        }
        return 'Other';
    });
    const [customLender, setCustomLender] = useState(() =>
        application.lenderId ? '' : application.lenderName || '',
    );
    const [loanAmount, setLoanAmount] = useState(String(application.loanAmount));
    const [interestRate, setInterestRate] = useState(String(application.interestRate));
    const [tenureMonths, setTenureMonths] = useState(String(application.tenureMonths));
    const standardTenures = ['12', '24', '36', '48', '60', '84'];
    const [isCustomTenure, setIsCustomTenure] = useState(
        !standardTenures.includes(String(application.tenureMonths)),
    );
    const [commissionAmount, setCommissionAmount] = useState(String(application.commissionAmount));
    const [branchId, setBranchId] = useState(application.branchId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setCustomerName(application.customerName);
        if (application.lenderId && lenders.some((l) => l.id === application.lenderId)) {
            setSelectedLenderValue(application.lenderId);
            setCustomLender('');
        } else {
            setSelectedLenderValue('Other');
            setCustomLender(application.lenderName || '');
        }
        setLoanAmount(String(application.loanAmount));
        setInterestRate(String(application.interestRate));
        setTenureMonths(String(application.tenureMonths));
        setIsCustomTenure(!standardTenures.includes(String(application.tenureMonths)));
        setCommissionAmount(String(application.commissionAmount));
        setBranchId(application.branchId);
        setErrorMessage(null);
    }, [application, lenders]);

    if (!isOpen) return null;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);

        const amount = parseFloat(loanAmount);
        const rate = parseFloat(interestRate);
        const tenure = parseInt(tenureMonths, 10);
        const comm = commissionAmount.trim() ? parseFloat(commissionAmount) : 0;

        if (!customerName.trim()) {
            setErrorMessage('Customer name is required.');
            return;
        }

        let finalLenderName = '';
        let finalLenderId: string | undefined = undefined;

        if (selectedLenderValue === 'Other') {
            finalLenderName = customLender.trim();
            if (!finalLenderName) {
                setErrorMessage('Lender name is required.');
                return;
            }
        } else {
            const found = lenders.find((l) => l.id === selectedLenderValue);
            if (found) {
                finalLenderId = found.id;
                finalLenderName = found.name;
            } else {
                finalLenderName = selectedLenderValue;
            }
        }

        if (isNaN(amount) || amount <= 0) {
            setErrorMessage('Loan amount must be greater than zero.');
            return;
        }

        if (isNaN(rate) || rate < 0 || rate > 100) {
            setErrorMessage('Interest rate must be between 0% and 100%.');
            return;
        }

        if (isNaN(tenure) || tenure < 1 || tenure > 360) {
            setErrorMessage('Tenure must be between 1 and 360 months.');
            return;
        }

        if (isNaN(comm) || comm < 0) {
            setErrorMessage('Commission amount cannot be negative.');
            return;
        }

        const payload: Record<string, unknown> = {
            customerName: customerName.trim(),
            loanAmount: amount,
            interestRate: rate,
            tenureMonths: tenure,
            commissionAmount: comm,
            branchId: branchId.trim(),
        };

        if (finalLenderId) {
            payload.lenderId = finalLenderId;
            payload.lenderName = finalLenderName;
        } else {
            payload.lenderName = finalLenderName;
        }

        setIsSubmitting(true);
        try {
            const updated = await apiRequest<LoanApplicationRecord>(
                `/finance/loans/${application.id}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                },
            );
            onSuccess(updated);
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                setErrorMessage(err.message);
            } else if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('Failed to update loan application.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="loan-modal-backdrop" role="dialog" aria-modal="true">
            <section className="loan-modal">
                <div className="loan-modal-heading">
                    <div>
                        <h2>Edit Loan Application</h2>
                        <p>Update customer details, tenure, or amounts for {application.customerName}</p>
                    </div>
                    <button
                        className="loan-modal-close"
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Close dialog"
                    >
                        ×
                    </button>
                </div>

                {errorMessage && (
                    <div className="loan-modal-error" role="alert">
                        <strong>Error: </strong>
                        {errorMessage}
                    </div>
                )}

                <form className="loan-modal-form" onSubmit={handleSubmit}>
                    <label>
                        Customer Full Name *
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Enter customer full name"
                            required
                            disabled={isSubmitting}
                        />
                    </label>

                    <label>
                        Lender Partner *
                        <select
                            value={selectedLenderValue}
                            onChange={(e) => setSelectedLenderValue(e.target.value)}
                            disabled={isSubmitting}
                        >
                            {lenders.map((lender) => (
                                <option key={lender.id} value={lender.id}>
                                    {lender.name}
                                </option>
                            ))}
                            <option value="Other">Other (Custom Lender)</option>
                        </select>
                    </label>

                    {selectedLenderValue === 'Other' && (
                        <label>
                            Custom Lender Name *
                            <input
                                type="text"
                                value={customLender}
                                onChange={(e) => setCustomLender(e.target.value)}
                                placeholder="e.g. Bank of Baroda"
                                required
                                disabled={isSubmitting}
                            />
                        </label>
                    )}

                    {user?.branches && user.branches.length > 1 && (
                        <label>
                            Dealership Branch *
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                disabled={isSubmitting}
                            >
                                {user.branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <label>
                        Loan Amount (₹) *
                        <input
                            type="number"
                            min="1"
                            step="any"
                            value={loanAmount}
                            onChange={(e) => setLoanAmount(e.target.value)}
                            placeholder="e.g. 750000"
                            required
                            disabled={isSubmitting}
                        />
                    </label>

                    <div className="loan-modal-grid">
                        <label>
                            Interest Rate (% p.a.) *
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={interestRate}
                                onChange={(e) => setInterestRate(e.target.value)}
                                placeholder="e.g. 9.5"
                                required
                                disabled={isSubmitting}
                            />
                        </label>

                        <label>
                            Tenure (months) *
                            {isCustomTenure ? (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="360"
                                        value={tenureMonths}
                                        onChange={(e) => setTenureMonths(e.target.value)}
                                        placeholder="Months"
                                        required
                                        disabled={isSubmitting}
                                    />
                                    <button
                                        type="button"
                                        className="loan-button-secondary"
                                        style={{ padding: '0 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                        onClick={() => {
                                            setIsCustomTenure(false);
                                            setTenureMonths('48');
                                        }}
                                    >
                                        Preset
                                    </button>
                                </div>
                            ) : (
                                <select
                                    value={tenureMonths}
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') {
                                            setIsCustomTenure(true);
                                        } else {
                                            setTenureMonths(e.target.value);
                                        }
                                    }}
                                    disabled={isSubmitting}
                                >
                                    <option value="12">12 months (1 yr)</option>
                                    <option value="24">24 months (2 yrs)</option>
                                    <option value="36">36 months (3 yrs)</option>
                                    <option value="48">48 months (4 yrs)</option>
                                    <option value="60">60 months (5 yrs)</option>
                                    <option value="84">84 months (7 yrs)</option>
                                    <option value="custom">Custom tenure (enter months)...</option>
                                </select>
                            )}
                        </label>
                    </div>

                    <label>
                        Commission Amount (₹)
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={commissionAmount}
                            onChange={(e) => setCommissionAmount(e.target.value)}
                            placeholder="Enter commission amount (₹)"
                            disabled={isSubmitting}
                        />
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Variable commission amount. Enter any amount you want.
                        </span>
                    </label>

                    <div className="loan-modal-actions">
                        <button
                            className="loan-button-secondary"
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            className="loan-button-primary"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

interface OverviewTabProps {
    metrics: LoanMetrics | null;
    isLoadingMetrics: boolean;
    metricsError: string | null;
    onRetryMetrics: () => void;
    onNewApplication: () => void;
    onSelectApplication: (application: LoanApplicationRecord) => void;
    onEditApplication: (application: LoanApplicationRecord) => void;
    refreshTrigger: number;
    lenders: LenderRecord[];
}

function OverviewTab({
    metrics,
    isLoadingMetrics,
    metricsError,
    onRetryMetrics,
    onNewApplication,
    onSelectApplication,
    onEditApplication,
    refreshTrigger,
    lenders,
}: OverviewTabProps) {
    const { selectedBranchId } = useAuth();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [lenderFilter, setLenderFilter] = useState<string>('ALL');
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [page, setPage] = useState(1);

    const isDateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

    const [loans, setLoans] = useState<LoanApplicationRecord[]>([]);
    const [totalLoans, setTotalLoans] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoadingLoans, setIsLoadingLoans] = useState(true);
    const [loansError, setLoansError] = useState<string | null>(null);
    const cacheRef = useRef<Map<string, PaginatedLoansResponse>>(new Map());

    // Invalidate cache when external refresh triggers (like status change or edits)
    useEffect(() => {
        cacheRef.current.clear();
    }, [refreshTrigger, selectedBranchId, statusFilter, lenderFilter, fromDate, toDate]);

    // Reset page to 1 on branch filter change
    useEffect(() => {
        setPage(1);
    }, [selectedBranchId]);

    // Debounce customer search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch paginated loans with instant client-side cache
    const fetchLoans = useCallback(async () => {
        if (fromDate && toDate && fromDate > toDate) {
            // "From > To → show 'From date is after To date', no request."
            return;
        }

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '8');

        if (selectedBranchId && selectedBranchId !== 'ALL') {
            params.set('branchId', selectedBranchId);
        }
        if (statusFilter !== 'ALL') {
            params.set('status', statusFilter);
        }
        if (lenderFilter !== 'ALL') {
            params.set('lender', lenderFilter);
        }
        if (debouncedSearch.trim()) {
            params.set('search', debouncedSearch.trim());
        }
        if (fromDate) {
            params.set('fromDate', fromDate);
        }
        if (toDate) {
            params.set('toDate', toDate);
        }

        const cacheKey = params.toString();
        const cached = cacheRef.current.get(cacheKey);

        if (cached) {
            setLoans(cached.data);
            setTotalLoans(cached.total);
            setTotalPages(Math.max(1, cached.totalPages));
            setIsLoadingLoans(false);
            setLoansError(null);
            return;
        }

        setIsLoadingLoans(true);
        setLoansError(null);
        try {
            const res = await apiRequest<PaginatedLoansResponse>(
                `/finance/loans?${cacheKey}`,
            );
            cacheRef.current.set(cacheKey, res);
            setLoans(res.data);
            setTotalLoans(res.total);
            setTotalPages(Math.max(1, res.totalPages));
        } catch (err: unknown) {
            setLoansError(
                err instanceof Error ? err.message : 'Failed to load loan applications.',
            );
        } finally {
            setIsLoadingLoans(false);
        }
    }, [page, statusFilter, lenderFilter, debouncedSearch, selectedBranchId, fromDate, toDate]);

    useEffect(() => {
        fetchLoans();
    }, [fetchLoans, refreshTrigger]);

    const availableFilterLenders = Array.from(
        new Set([
            ...lenders.map((l) => l.name),
            ...(metrics?.byLender?.map((l) => l.name) || []),
        ]),
    );

    const maxLenderVolume =
        metrics?.byLender && metrics.byLender.length > 0
            ? Math.max(...metrics.byLender.map((l) => l.totalAmount), 1)
            : 1;

    return (
        <>
            <div className="loan-metrics-grid">
                <article className="loan-metric-card">
                    <span className="loan-metric-label">APPLICATIONS</span>
                    <strong>{isLoadingMetrics ? '...' : (metrics?.totalApplications ?? 0)}</strong>
                </article>
                <article className="loan-metric-card">
                    <span className="loan-metric-label">DISBURSED</span>
                    <strong>{isLoadingMetrics ? '...' : (metrics?.disbursedCount ?? 0)}</strong>
                </article>
                <article className="loan-metric-card">
                    <span className="loan-metric-label">TOTAL DISBURSED VALUE</span>
                    <strong>
                        {isLoadingMetrics
                            ? '...'
                            : formatCurrencyCompact(metrics?.totalDisbursedAmount ?? 0)}
                    </strong>
                </article>
                <article className="loan-metric-card">
                    <span className="loan-metric-label">COMMISSION EARNED</span>
                    <strong>
                        {isLoadingMetrics
                            ? '...'
                            : formatCurrencyCompact(metrics?.totalCommissionEarned ?? 0)}
                    </strong>
                </article>
            </div>

            {metricsError && (
                <div className="loan-error-state" role="alert">
                    <span>Failed to load portfolio metrics: {metricsError}</span>
                    <button
                        className="loan-button-secondary"
                        type="button"
                        onClick={onRetryMetrics}
                    >
                        Retry Metrics
                    </button>
                </div>
            )}

            <section className="loan-panel lender-panel">
                <div className="loan-panel-heading lender-panel-heading">
                    <h2>Loan Value by Lender Partner</h2>
                    <span>
                        See the <strong>Bank-wise Tie-ups</strong> tab for institutional partner overview
                    </span>
                </div>
                <div className="lender-bars">
                    {isLoadingMetrics ? (
                        <div className="loan-loading-state">Loading lender partner volumes...</div>
                    ) : metrics?.byLender && metrics.byLender.length > 0 ? (
                        metrics.byLender.map((lender, index) => {
                            const widthPercent = Math.min(
                                100,
                                Math.max(8, Math.round((lender.totalAmount / maxLenderVolume) * 100)),
                            );
                            return (
                                <div className="lender-row" key={`${lender.name}-${index}`}>
                                    <div className="lender-row-label">
                                        <span>
                                            {lender.name}{' '}
                                            <small style={{ color: '#64748b' }}>
                                                ({lender.count} {lender.count === 1 ? 'file' : 'files'})
                                            </small>
                                        </span>
                                        <strong>{formatCurrencyCompact(lender.totalAmount)}</strong>
                                    </div>
                                    <div className="loan-progress-track">
                                        <div
                                            className="loan-progress-fill"
                                            style={{ width: `${widthPercent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div
                            style={{
                                padding: '20px 0',
                                color: '#64748b',
                                textAlign: 'center',
                                fontSize: '13px',
                            }}
                        >
                            No loan partner volumes aggregated yet. Applications will appear here as they are created and processed.
                        </div>
                    )}
                </div>
            </section>

            <section className="loan-table-section">
                <div className="loan-filters">
                    <label className="loan-search-box">
                        <span aria-hidden="true">⌕</span>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search customer name..."
                            aria-label="Search customer"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </label>

                    <select
                        className="loan-filter-select"
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Filter by status"
                    >
                        <option value="ALL">Status: All</option>
                        {Object.entries(statusLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                                Status: {label}
                            </option>
                        ))}
                    </select>

                    <select
                        className="loan-filter-select lender-filter"
                        value={lenderFilter}
                        onChange={(event) => {
                            setLenderFilter(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Filter by lender"
                    >
                        <option value="ALL">Lender: All</option>
                        {availableFilterLenders.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>

                    <label className="loan-date-filter-label">
                        <span>From</span>
                        <input
                            type="date"
                            className="loan-date-input"
                            value={fromDate}
                            onChange={(e) => {
                                setFromDate(e.target.value);
                                setPage(1);
                            }}
                            aria-label="Filter from date"
                        />
                    </label>

                    <label className="loan-date-filter-label">
                        <span>To</span>
                        <input
                            type="date"
                            className="loan-date-input"
                            value={toDate}
                            onChange={(e) => {
                                setToDate(e.target.value);
                                setPage(1);
                            }}
                            aria-label="Filter to date"
                        />
                    </label>

                    {(fromDate || toDate) && (
                        <button
                            type="button"
                            className="loan-date-clear-link"
                            onClick={() => {
                                setFromDate('');
                                setToDate('');
                                setPage(1);
                            }}
                        >
                            Clear
                        </button>
                    )}

                    {isDateRangeInvalid && (
                        <span className="loan-date-range-error" role="alert">
                            From date is after To date
                        </span>
                    )}

                    <span className="loan-record-count">
                        {isLoadingLoans ? 'Loading...' : `${totalLoans} records`}
                    </span>
                </div>

                {loansError ? (
                    <div className="loan-error-state" role="alert">
                        <span>Failed to load loan applications: {loansError}</span>
                        <button
                            className="loan-button-secondary"
                            type="button"
                            onClick={fetchLoans}
                        >
                            Retry Loading
                        </button>
                    </div>
                ) : (
                    <div className="loan-table-wrapper">
                        <table className="loan-table">
                            <thead>
                                <tr>
                                    <th>CUSTOMER</th>
                                    <th>LENDER</th>
                                    <th className="align-right">LOAN AMOUNT</th>
                                    <th className="align-right">RATE</th>
                                    <th>STATUS</th>
                                    <th className="align-right">COMMISSION</th>
                                    <th className="align-center">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoadingLoans ? (
                                    <tr>
                                        <td colSpan={7} className="loan-loading-state">
                                            Loading applications from backend...
                                        </td>
                                    </tr>
                                ) : loans.length > 0 ? (
                                    loans.map((application) => (
                                        <tr
                                            key={application.id}
                                            onClick={() => onSelectApplication(application)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td>
                                                <strong>{application.customerName}</strong>
                                                {application.branch?.name && (
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                        {application.branch.name}
                                                    </div>
                                                )}
                                            </td>
                                            <td>{application.lenderName}</td>
                                            <td className="align-right">
                                                {formatINR(application.loanAmount)}
                                            </td>
                                            <td className="align-right">
                                                {parseFloat(String(application.interestRate)).toFixed(2)}%
                                            </td>
                                            <td>
                                                <StatusBadge status={application.status} />
                                            </td>
                                            <td className="align-right">
                                                {formatINR(application.commissionAmount)}
                                            </td>
                                            <td className="align-center" onClick={(e) => e.stopPropagation()}>
                                                {application.status !== 'SANCTIONED' && application.status !== 'DISBURSED' && (
                                                    <button
                                                        type="button"
                                                        className="loan-row-edit-btn"
                                                        onClick={() => onEditApplication(application)}
                                                        title="Edit loan details"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="loan-empty-state" colSpan={7}>
                                            No applications match your search or filters. Click &quot;+ New Finance Application&quot; to create one.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="loan-table-footer">
                    <span>
                        Page {page} of {Math.max(1, totalPages)} ({totalLoans} total)
                    </span>
                    <div className="loan-pagination">
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            disabled={page <= 1 || isLoadingLoans}
                        >
                            ← Prev
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            disabled={page >= totalPages || isLoadingLoans}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </section>

            <div className="loan-create-hidden">
                <button type="button" onClick={onNewApplication}>
                    New application
                </button>
            </div>
        </>
    );
}

const LENDER_SECTIONS = [
    { type: 'BANK' as const, title: 'Banks' },
    { type: 'NBFC' as const, title: 'Finance companies (NBFCs)' },
    { type: 'OTHER' as const, title: 'Bank subsidiaries / service arms / others' },
    { type: 'INSURANCE' as const, title: 'Insurance' },
];

interface BankTieUpsTabProps {
    metrics: LoanMetrics | null;
    isLoadingMetrics: boolean;
    metricsError: string | null;
    activeLenders: LenderRecord[];
    inactiveLenders: LenderRecord[];
    isLoadingActiveLenders: boolean;
    isLoadingInactiveLenders: boolean;
    activeLendersError: string | null;
    inactiveLendersError: string | null;
}

function BankCard({ bank }: { bank: BankCardItem }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const effectivePayout =
        bank.metric && bank.metric.totalAmount > 0
            ? `${((bank.metric.commission / bank.metric.totalAmount) * 100).toFixed(2)}%`
            : '-';

    const formatValueOrDash = (amt: number | undefined | null) => {
        if (!amt || amt === 0) return '-';
        return formatINR(amt);
    };

    const panelId = `breakdown-${bank.key}`;

    return (
        <article
            className={`tieup-bank-card ${!bank.isActive ? 'tieup-bank-card-inactive' : ''}`}
        >
            <div className="tieup-bank-heading">
                <span className="tieup-bank-icon">{bank.icon}</span>
                <div className="tieup-bank-info">
                    <h3>{bank.name}</h3>
                    {!bank.metric || bank.metric.count === 0 ? (
                        <div className="tieup-bank-status-summary">No active files</div>
                    ) : (
                        <div className="tieup-bank-status-counts">
                            <div className="tieup-status-count-item">
                                Disbursed: {bank.metric.disbursedCount ?? 0}
                            </div>
                            <div className="tieup-status-count-item">
                                Pending: {bank.metric.pendingCount ?? 0}
                            </div>
                            {(bank.metric.rejectedCount ?? 0) > 0 && (
                                <div className="tieup-status-count-item">
                                    Rejected: {bank.metric.rejectedCount}
                                </div>
                            )}
                            {(bank.metric.enquiryCount ?? 0) > 0 && (
                                <div className="tieup-status-count-item">
                                    Enquiry: {bank.metric.enquiryCount}
                                </div>
                            )}
                        </div>
                    )}
                    <p>{bank.type}</p>
                </div>
                {!bank.isActive ? (
                    <span className="tieup-inactive-badge">
                        Inactive
                    </span>
                ) : bank.metric && bank.metric.count > 0 ? (
                    <span className="tieup-active-badge">
                        <span /> Active ({bank.metric.count}{' '}
                        {bank.metric.count === 1 ? 'file' : 'files'})
                    </span>
                ) : (
                    <span className="tieup-inactive-badge">
                        No active files
                    </span>
                )}
            </div>

            {bank.tallyLedgerName && (
                <div className="tieup-tally-ledger" style={{ whiteSpace: 'pre-wrap' }}>
                    Tally ledger: {bank.tallyLedgerName}
                </div>
            )}

            <div className="tieup-summary-row">
                <span>Total Applied Volume (All Statuses)</span>
                <strong>{formatCurrencyCompact(bank.metric?.totalAmount ?? 0)}</strong>
            </div>

            <div className="tieup-summary-row">
                <span>Recorded Commission</span>
                <strong>{formatINR(bank.metric?.commission ?? 0)}</strong>
            </div>

            <div className="tieup-summary-row" style={{ borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none' }}>
                <span>Effective Dealership Payout</span>
                <strong className="tieup-payout">{effectivePayout}</strong>
            </div>

            <button
                type="button"
                className="tieup-breakdown-toggle-btn"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
            >
                <span>Outstanding &amp; status breakdown</span>
                <span className={`tieup-toggle-chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
                    ▾
                </span>
            </button>

            {isExpanded && (
                <div id={panelId} className="tieup-breakdown-panel">
                    <div className="tieup-outstanding-box">
                        <span className="tieup-outstanding-label">
                            Outstanding = loan value pending disbursement
                        </span>
                        <strong className="tieup-outstanding-value">
                            {formatValueOrDash(bank.metric?.pendingAmount)}
                        </strong>
                    </div>

                    <div className="tieup-breakdown-row">
                        <span>Disbursed value</span>
                        <strong>{formatValueOrDash(bank.metric?.disbursedAmount)}</strong>
                    </div>

                    <div className="tieup-breakdown-row">
                        <span>Rejected value</span>
                        <strong>{formatValueOrDash(bank.metric?.rejectedAmount)}</strong>
                    </div>

                    {((bank.metric?.enquiryCount ?? 0) > 0 || (bank.metric?.enquiryAmount ?? 0) > 0) && (
                        <div className="tieup-breakdown-row">
                            <span>Enquiry value</span>
                            <strong>{formatValueOrDash(bank.metric?.enquiryAmount)}</strong>
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}

function BankTieUpsTab({
    metrics,
    isLoadingMetrics,
    metricsError,
    activeLenders,
    inactiveLenders,
    isLoadingActiveLenders,
    isLoadingInactiveLenders,
    activeLendersError,
    inactiveLendersError,
}: BankTieUpsTabProps) {
    const allMasterLenders = [...activeLenders, ...inactiveLenders];

    const matchedMetricIndices = new Set<number>();

    const masterCards: BankCardItem[] = allMasterLenders.map((lender) => {
        let metricIndex = -1;
        if (metrics?.byLender) {
            metricIndex = metrics.byLender.findIndex(
                (m) => Boolean(m.id && m.id === lender.id),
            );
            if (metricIndex === -1) {
                metricIndex = metrics.byLender.findIndex(
                    (m) => m.name.toLowerCase().trim() === lender.name.toLowerCase().trim(),
                );
            }
        }

        let metric;
        if (metricIndex !== -1 && metrics?.byLender) {
            matchedMetricIndices.add(metricIndex);
            metric = metrics.byLender[metricIndex];
        }

        const typeLabel =
            lender.type === 'NBFC'
                ? 'NBFC'
                : lender.type === 'BANK'
                    ? 'Bank'
                    : lender.type === 'INSURANCE'
                        ? 'Insurance'
                        : lender.type || 'Lender';

        const icon =
            lender.type === 'NBFC'
                ? '🏦'
                : lender.type === 'BANK'
                    ? '🏢'
                    : lender.type === 'INSURANCE'
                        ? '🛡️'
                        : '🏛️';

        return {
            key: `lender-${lender.id}`,
            name: lender.name,
            tallyLedgerName: lender.tallyLedgerName,
            type: typeLabel,
            lenderType: lender.type,
            icon,
            isActive: lender.isActive,
            metric,
            isCustom: false,
        };
    });

    const customCards: BankCardItem[] = [];
    if (metrics?.byLender) {
        metrics.byLender.forEach((metric, index) => {
            if (!matchedMetricIndices.has(index)) {
                customCards.push({
                    key: `custom-${metric.name}-${index}`,
                    name: metric.name,
                    tallyLedgerName: metric.name,
                    type: 'Custom lender',
                    lenderType: 'OTHER',
                    icon: '🏦',
                    isActive: true,
                    metric,
                    isCustom: true,
                });
            }
        });
    }

    const allCards = [...masterCards, ...customCards];

    const sections = LENDER_SECTIONS.map((sec) => {
        const cardsInSection = allCards
            .filter((c) => c.lenderType === sec.type)
            .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
            );
        const sectionVolume = cardsInSection.reduce(
            (sum, c) => sum + (c.metric?.totalAmount || 0),
            0,
        );
        return {
            ...sec,
            cards: cardsInSection,
            volume: sectionVolume,
        };
    }).filter((sec) => sec.cards.length > 0);

    const hasCriticalError = Boolean(metricsError || activeLendersError);
    const isLoading = Boolean(
        isLoadingMetrics || isLoadingActiveLenders || isLoadingInactiveLenders,
    );

    return (
        <section className="loan-panel tieups-panel">
            <div className="tieup-summary-grid">
                <div className="tieup-summary-card">
                    <span>BANKS / NBFCs TIED UP</span>
                    <strong>{isLoadingActiveLenders ? '...' : activeLenders.length}</strong>
                </div>

                <div className="tieup-summary-card">
                    <span>TOTAL DISBURSED VALUE</span>
                    <strong>
                        {isLoadingMetrics
                            ? '...'
                            : formatCurrencyCompact(metrics?.totalDisbursedAmount ?? 0)}
                    </strong>
                </div>

                <div className="tieup-summary-card">
                    <span>COMMISSION EARNED</span>
                    <strong>
                        {isLoadingMetrics
                            ? '...'
                            : formatCurrencyCompact(metrics?.totalCommissionEarned ?? 0)}
                    </strong>
                </div>

                <div className="tieup-summary-card">
                    <span>API STATUS</span>
                    <strong
                        style={{
                            fontSize: '20px',
                            color: hasCriticalError ? '#dc2626' : '#059669',
                        }}
                    >
                        {hasCriticalError ? 'Offline' : 'API Live'}
                    </strong>
                </div>
            </div>

            {hasCriticalError && (
                <div className="loan-error-state" role="alert">
                    <span>Failed to load partner tie-up data: {activeLendersError || metricsError}</span>
                </div>
            )}

            {inactiveLendersError && (
                <div className="tieup-notice" role="status">
                    ⚠️ Inactive lenders could not be loaded: {inactiveLendersError}
                </div>
            )}

            {isLoading && sections.length === 0 ? (
                <div className="loan-empty-state">
                    <p>Loading lender partner agreements...</p>
                </div>
            ) : sections.length === 0 ? (
                <div className="loan-empty-state">
                    <p>No active lenders or loan records found.</p>
                </div>
            ) : (
                sections.map((sec) => (
                    <div className="tieup-section" key={sec.type}>
                        <div className="tieup-section-header">
                            <div className="tieup-section-title-wrap">
                                <h3 className="tieup-section-title">{sec.title}</h3>
                                <span className="tieup-section-count">
                                    {sec.cards.length} {sec.cards.length === 1 ? 'lender' : 'lenders'}
                                </span>
                            </div>
                            <span className="tieup-section-volume">
                                Applied volume (all statuses):
                                <strong>{formatCurrencyCompact(sec.volume)}</strong>
                            </span>
                        </div>

                        <div className="tieup-cards-grid">
                            {sec.cards.map((bank) => (
                                <BankCard key={bank.key} bank={bank} />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </section>
    );
}

export interface LoanPayoutReceiptRecord {
    id: string;
    payoutId: string;
    amount: number;
    receivedDate: string;
    reference: string | null;
    receivedInto: string | null;
    createdById: string;
    createdBy: {
        id: string;
        firstName: string;
        lastName: string;
    };
    createdAt: string;
}

export interface LoanPayoutHistoryRecord {
    id: string;
    payoutId: string;
    userId: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
    };
    field: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
}

export interface LoanPayoutRecord {
    id: string;
    loanId: string;
    kind: 'LOAN_AMOUNT' | 'COMMISSION';
    customerName: string;
    branchId: string;
    branchName: string;
    lenderId: string | null;
    lenderName: string;
    expectedAmount: number;
    receivedAmount: number;
    outstandingAmount: number;
    expectedDate: string;
    dateEstimated: boolean;
    status: 'PENDING' | 'PARTIAL' | 'RECEIVED' | 'OVERDUE';
    daysOverdue: number;
    notes: string | null;
    createdAt: string;
    receipts: LoanPayoutReceiptRecord[];
    history: LoanPayoutHistoryRecord[];
}

export interface PayoutSummaryResponse {
    totalExpected: number;
    totalReceived: number;
    totalOutstanding: number;
    overdueAmount: number;
    overdueCount: number;
    dateToConfirmCount: number;
    byKind?: Record<string, { expected: number; received: number; outstanding: number; overdue: number; count: number }>;
    byLender: {
        id: string | null;
        name: string;
        count: number;
        totalExpected: number;
        totalReceived: number;
        totalOutstanding: number;
        overdueAmount: number;
        overdueCount: number;
    }[];
}

interface PaginatedPayoutsResponse {
    data: LoanPayoutRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface PayoutTrackerTabProps {
    lenders: LenderRecord[];
    refreshTrigger: number;
    onRefresh: () => void;
}

function PayoutStatusBadge({ status, daysOverdue, dateEstimated }: { status: string; daysOverdue?: number; dateEstimated?: boolean }) {
    if (status === 'RECEIVED') {
        return (
            <span className="payout-badge received" title="Full payout received from financer">
                ✓ Received
            </span>
        );
    }
    if (status === 'PARTIAL') {
        return (
            <span className="payout-badge partial" title="Partly received payout">
                ◑ Partly received
            </span>
        );
    }
    if (status === 'OVERDUE') {
        return (
            <span className="payout-badge overdue" title={`Overdue by ${daysOverdue ?? 0} days`}>
                ⚠️ Overdue ({daysOverdue ?? 0}d)
            </span>
        );
    }
    return (
        <span className="payout-badge pending" title="Waiting for payout">
            ⏳ Waiting {dateEstimated ? '(Estimated date)' : ''}
        </span>
    );
}

function PayoutTrackerTab({ lenders, refreshTrigger, onRefresh }: PayoutTrackerTabProps) {
    const { user, selectedBranchId } = useAuth();
    const canManagePayout = user?.roles?.includes('SYSTEM_ADMIN') || user?.permissions?.includes('PAYOUT_MANAGE');

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [kindFilter, setKindFilter] = useState('ALL');
    const [lenderFilter, setLenderFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [overdueOnly, setOverdueOnly] = useState(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('payoutId')) return false;
            return params.get('overdue') === 'true' || params.get('status') === 'OVERDUE';
        } catch {
            return false;
        }
    });
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);

    const [payouts, setPayouts] = useState<LoanPayoutRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [summary, setSummary] = useState<PayoutSummaryResponse | null>(null);
    const [isLoadingSummary, setIsLoadingSummary] = useState(true);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    // Detail drawer & Modals
    const [selectedPayout, setSelectedPayout] = useState<LoanPayoutRecord | null>(null);
    const [recordingReceiptPayout, setRecordingReceiptPayout] = useState<LoanPayoutRecord | null>(null);
    const [editingPayout, setEditingPayout] = useState<LoanPayoutRecord | null>(null);

    // Check for payoutId from URL and open detail drawer for that particular payout
    const checkAndFocusPayout = useCallback(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const payoutId = params.get('payoutId');
            if (payoutId) {
                apiRequest<LoanPayoutRecord>(`/finance/payouts/${encodeURIComponent(payoutId)}`)
                    .then((p) => {
                        if (p) {
                            setSelectedPayout(p);
                        }
                    })
                    .catch(() => {});
            }
        } catch {}
    }, []);

    useEffect(() => {
        checkAndFocusPayout();
        window.addEventListener('popstate', checkAndFocusPayout);
        window.addEventListener('nexus:navigate-tab', checkAndFocusPayout);
        return () => {
            window.removeEventListener('popstate', checkAndFocusPayout);
            window.removeEventListener('nexus:navigate-tab', checkAndFocusPayout);
        };
    }, [checkAndFocusPayout]);

    // Receipt form fields
    const [receiptAmount, setReceiptAmount] = useState('');
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [receivedInto, setReceivedInto] = useState('');
    const [receiptWarning, setReceiptWarning] = useState<string | null>(null);
    const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
    const [receiptFormError, setReceiptFormError] = useState<string | null>(null);

    // Edit payout terms fields
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
    const [editFormError, setEditFormError] = useState<string | null>(null);

    // Debounce customer search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch Summary Cards
    const fetchSummary = useCallback(async () => {
        setIsLoadingSummary(true);
        setSummaryError(null);
        try {
            const params = new URLSearchParams();
            if (selectedBranchId && selectedBranchId !== 'ALL') params.set('branchId', selectedBranchId);
            if (kindFilter !== 'ALL') params.set('kind', kindFilter);
            if (lenderFilter !== 'ALL') params.set('lenderId', lenderFilter);
            if (fromDate) params.set('fromDate', fromDate);
            if (toDate) params.set('toDate', toDate);

            const res = await apiRequest<PayoutSummaryResponse>(`/finance/payouts/summary?${params.toString()}`);
            setSummary(res);
        } catch (err: unknown) {
            setSummaryError(err instanceof Error ? err.message : 'Failed to load payout summary');
        } finally {
            setIsLoadingSummary(false);
        }
    }, [selectedBranchId, kindFilter, lenderFilter, fromDate, toDate]);

    // Fetch Paginated Payouts Table
    const fetchPayouts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', '10');
            if (selectedBranchId && selectedBranchId !== 'ALL') params.set('branchId', selectedBranchId);
            if (kindFilter !== 'ALL') params.set('kind', kindFilter);
            if (statusFilter !== 'ALL') params.set('status', statusFilter);
            if (kindFilter !== 'ALL') params.set('kind', kindFilter);
            if (lenderFilter !== 'ALL') params.set('lenderId', lenderFilter);
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
            if (overdueOnly) params.set('overdueOnly', 'true');
            if (fromDate) params.set('fromDate', fromDate);
            if (toDate) params.set('toDate', toDate);

            const res = await apiRequest<PaginatedPayoutsResponse>(`/finance/payouts?${params.toString()}`);
            setPayouts(res.data);
            setTotal(res.total);
            setTotalPages(Math.max(1, res.totalPages));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load payouts');
        } finally {
            setIsLoading(false);
        }
    }, [page, selectedBranchId, kindFilter, statusFilter, lenderFilter, debouncedSearch, overdueOnly, fromDate, toDate]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary, refreshTrigger]);

    useEffect(() => {
        fetchPayouts();
    }, [fetchPayouts, refreshTrigger]);

    const handleOpenReceiptModal = (payout: LoanPayoutRecord) => {
        setRecordingReceiptPayout(payout);
        setReceiptAmount(String(payout.outstandingAmount > 0 ? payout.outstandingAmount : ''));
        setReceivedDate(new Date().toISOString().split('T')[0]);
        setReference('');
        setReceivedInto('');
        setReceiptWarning(null);
        setReceiptFormError(null);
    };

    const handleRecordReceiptSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!recordingReceiptPayout) return;
        setReceiptFormError(null);
        setReceiptWarning(null);

        const amt = parseFloat(receiptAmount);
        if (isNaN(amt) || amt <= 0) {
            setReceiptFormError('Receipt amount must be greater than zero.');
            return;
        }

        setIsSubmittingReceipt(true);
        try {
            const res = await apiRequest<{ warning?: string }>(`/finance/payouts/${recordingReceiptPayout.id}/receipts`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: amt,
                    receivedDate,
                    reference: reference.trim() || undefined,
                    receivedInto: receivedInto.trim() || undefined,
                }),
            });

            if (res.warning) {
                setReceiptWarning(res.warning);
            }
            onRefresh();
            setRecordingReceiptPayout(null);
        } catch (err: unknown) {
            setReceiptFormError(err instanceof Error ? err.message : 'Failed to record payment receipt');
        } finally {
            setIsSubmittingReceipt(false);
        }
    };

    const handleOpenEditModal = (payout: LoanPayoutRecord) => {
        setEditingPayout(payout);
        setEditAmount(String(payout.expectedAmount));
        setEditDate(payout.expectedDate.split('T')[0]);
        setEditNotes(payout.notes || '');
        setEditFormError(null);
    };

    const handleEditPayoutSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingPayout) return;
        setEditFormError(null);

        const amt = parseFloat(editAmount);
        if (isNaN(amt) || amt < 0) {
            setEditFormError('Expected amount cannot be negative.');
            return;
        }

        setIsSubmittingEdit(true);
        try {
            await apiRequest(`/finance/payouts/${editingPayout.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    expectedAmount: amt,
                    expectedDate: editDate,
                    notes: editNotes.trim() || undefined,
                }),
            });
            onRefresh();
            setEditingPayout(null);
        } catch (err: unknown) {
            setEditFormError(err instanceof Error ? err.message : 'Failed to update payout terms');
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    return (
        <section className="payout-tracker-tab">
            {/* Split Summary Cards by Type */}
            {(() => {
                const doSummary = summary?.byKind?.LOAN_AMOUNT ?? { expected: 0, received: 0, outstanding: 0, overdue: 0, count: 0 };
                const commSummary = summary?.byKind?.COMMISSION ?? { expected: 0, received: 0, outstanding: 0, overdue: 0, count: 0 };

                return (
                    <>
                        {(kindFilter === 'ALL' || kindFilter === 'LOAN_AMOUNT') && (
                            <div className="payout-summary-group">
                                <div className="payout-summary-header">
                                    <span className="payout-kind-badge do-amount">DO amount</span>
                                    <span className="payout-summary-title">DO Amount Payouts (Loan Principal from Financer)</span>
                                </div>
                                <div className="loan-metrics-grid">
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">DO EXPECTED</span>
                                        <strong>{isLoadingSummary ? '...' : formatCurrencyCompact(doSummary.expected)}</strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Financer loan disbursement</span>
                                    </article>
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">DO RECEIVED</span>
                                        <strong style={{ color: '#0f766e' }}>
                                            {isLoadingSummary ? '...' : formatCurrencyCompact(doSummary.received)}
                                        </strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Cleared into accounts</span>
                                    </article>
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">DO OUTSTANDING</span>
                                        <strong style={{ color: '#1e40af' }}>
                                            {isLoadingSummary ? '...' : formatCurrencyCompact(doSummary.outstanding)}
                                        </strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Pending financer settlement</span>
                                    </article>
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">DO OVERDUE</span>
                                        <strong style={{ color: '#b91c1c' }}>
                                            {isLoadingSummary ? '...' : formatCurrencyCompact(doSummary.overdue)}
                                        </strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Past expected date</span>
                                    </article>
                                </div>
                            </div>
                        )}

                        {(kindFilter === 'ALL' || kindFilter === 'COMMISSION') && (
                            <div className="payout-summary-group">
                                <div className="payout-summary-header">
                                    <span className="payout-kind-badge commission">Commission</span>
                                    <span className="payout-summary-title">Commission Payouts (Dealership Commission)</span>
                                </div>
                                <div className="loan-metrics-grid">
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">COMMISSION EXPECTED</span>
                                        <strong>{isLoadingSummary ? '...' : formatCurrencyCompact(commSummary.expected)}</strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Financer payout (incl. GST)</span>
                                    </article>
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">COMMISSION RECEIVED</span>
                                        <strong style={{ color: '#0f766e' }}>
                                            {isLoadingSummary ? '...' : formatCurrencyCompact(commSummary.received)}
                                        </strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Cleared into accounts</span>
                                    </article>
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">COMMISSION OUTSTANDING</span>
                                        <strong style={{ color: '#1e40af' }}>
                                            {isLoadingSummary ? '...' : formatCurrencyCompact(commSummary.outstanding)}
                                        </strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Pending settlement (incl. GST)</span>
                                    </article>
                                    <article className="loan-metric-card">
                                        <span className="loan-metric-label">COMMISSION OVERDUE</span>
                                        <strong style={{ color: '#b91c1c' }}>
                                            {isLoadingSummary ? '...' : formatCurrencyCompact(commSummary.overdue)}
                                        </strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                            Past expected date
                                            {(summary?.dateToConfirmCount ?? 0) > 0 && (
                                                <span style={{ marginLeft: '4px', color: '#d97706' }}>
                                                    • {summary?.dateToConfirmCount} to confirm
                                                </span>
                                            )}
                                        </span>
                                    </article>
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}

            {summaryError && (
                <div className="loan-error-state" role="alert">
                    <span>Failed to load summary: {summaryError}</span>
                    <button className="loan-button-secondary" type="button" onClick={fetchSummary}>
                        Retry
                    </button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="loan-filters" style={{ marginTop: '16px' }}>
                <label className="loan-search-box">
                    <span aria-hidden="true">⌕</span>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search customer name..."
                        aria-label="Search customer"
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                            ×
                        </button>
                    )}
                </label>

                <select
                    className="loan-filter-select"
                    value={kindFilter}
                    onChange={(e) => {
                        setKindFilter(e.target.value);
                        setPage(1);
                    }}
                    aria-label="Filter by payout type"
                >
                    <option value="ALL">Type: All</option>
                    <option value="LOAN_AMOUNT">Type: DO amount</option>
                    <option value="COMMISSION">Type: Commission</option>
                </select>

                <select
                    className="loan-filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                    }}
                    aria-label="Filter by status"
                >
                    <option value="ALL">Status: All</option>
                    <option value="PENDING">Status: Waiting</option>
                    <option value="PARTIAL">Status: Partly received</option>
                    <option value="RECEIVED">Status: Received</option>
                    <option value="OVERDUE">Status: Overdue</option>
                </select>

                <select
                    className="loan-filter-select lender-filter"
                    value={lenderFilter}
                    onChange={(e) => {
                        setLenderFilter(e.target.value);
                        setPage(1);
                    }}
                    aria-label="Filter by lender"
                >
                    <option value="ALL">Financer: All</option>
                    {lenders.map((l) => (
                        <option key={l.id} value={l.id}>
                            {l.name}
                        </option>
                    ))}
                </select>

                <label className="payout-overdue-checkbox">
                    <input
                        type="checkbox"
                        checked={overdueOnly}
                        onChange={(e) => {
                            setOverdueOnly(e.target.checked);
                            setPage(1);
                        }}
                    />
                    <span>Overdue only</span>
                </label>

                <div className="payout-date-range">
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => {
                            setFromDate(e.target.value);
                            setPage(1);
                        }}
                        title="From expected date"
                    />
                    <span>to</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => {
                            setToDate(e.target.value);
                            setPage(1);
                        }}
                        title="To expected date"
                    />
                </div>

                <span className="loan-record-count">
                    {isLoading ? 'Loading...' : `${total} files`}
                </span>
            </div>

            {/* Payouts Table */}
            {error ? (
                <div className="loan-error-state" role="alert">
                    <span>Failed to load payouts: {error}</span>
                    <button className="loan-button-secondary" type="button" onClick={fetchPayouts}>
                        Retry Loading
                    </button>
                </div>
            ) : (
                <div className="loan-table-wrapper" style={{ marginTop: '14px' }}>
                    <table className="loan-table">
                        <thead>
                            <tr>
                                <th>CUSTOMER &amp; BRANCH</th>
                                <th>TYPE</th>
                                <th>FINANCER (LENDER)</th>
                                <th className="align-right">EXPECTED</th>
                                <th className="align-right">RECEIVED</th>
                                <th className="align-right">OUTSTANDING</th>
                                <th>EXPECTED DATE</th>
                                <th>STATUS</th>
                                <th className="align-center">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="loan-loading-state">
                                        Loading financer payouts...
                                    </td>
                                </tr>
                            ) : payouts.length > 0 ? (
                                payouts.map((p) => (
                                    <tr
                                        key={p.id}
                                        onClick={() => setSelectedPayout(p)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <strong>{p.customerName}</strong>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                {p.branchName}
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className={`payout-kind-badge ${p.kind === 'LOAN_AMOUNT' ? 'do-amount' : 'commission'}`}
                                                title={p.kind === 'LOAN_AMOUNT' ? 'DO amount (loan principal disbursement)' : 'Financer commission (incl. GST)'}
                                            >
                                                {p.kind === 'LOAN_AMOUNT' ? 'DO amount' : 'Commission'}
                                            </span>
                                        </td>
                                        <td>{p.lenderName}</td>
                                        <td className="align-right font-medium">
                                            <div>{formatINR(p.expectedAmount)}</div>
                                            {p.kind === 'COMMISSION' && (
                                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 400 }}>
                                                    incl. GST
                                                </div>
                                            )}
                                        </td>
                                        <td className="align-right font-medium" style={{ color: p.receivedAmount > 0 ? '#0f766e' : undefined }}>
                                            {formatINR(p.receivedAmount)}
                                        </td>
                                        <td className="align-right font-bold" style={{ color: p.outstandingAmount > 0 ? '#1e40af' : '#64748b' }}>
                                            {formatINR(p.outstandingAmount)}
                                        </td>
                                        <td>
                                            <div>
                                                {new Date(p.expectedDate).toLocaleDateString(undefined, {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </div>
                                            {p.dateEstimated && (
                                                <span className="payout-estimated-tag" title="Disbursement date was not explicitly recorded; date estimated">
                                                    Estimated date
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <PayoutStatusBadge
                                                status={p.status}
                                                daysOverdue={p.daysOverdue}
                                                dateEstimated={p.dateEstimated}
                                            />
                                        </td>
                                        <td className="align-center" onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                {canManagePayout && (
                                                    <button
                                                        type="button"
                                                        className="loan-row-edit-btn"
                                                        onClick={() => handleOpenReceiptModal(p)}
                                                        title="Record payment received from lender"
                                                    >
                                                        + Record payment
                                                    </button>
                                                )}
                                                {canManagePayout && (
                                                    <button
                                                        type="button"
                                                        className="loan-row-edit-btn"
                                                        style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#475569' }}
                                                        onClick={() => handleOpenEditModal(p)}
                                                        title="Edit expected payout terms"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="loan-empty-state" colSpan={8}>
                                        No disbursed loan payouts match your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            <div className="loan-table-footer">
                <span>
                    Page {page} of {Math.max(1, totalPages)} ({total} total payouts)
                </span>
                <div className="loan-pagination">
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1 || isLoading}
                    >
                        ← Prev
                    </button>
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page >= totalPages || isLoading}
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* Record Payment Receipt Modal */}
            {recordingReceiptPayout && (
                <div className="loan-modal-backdrop" role="dialog" aria-modal="true">
                    <section className="loan-modal" style={{ maxWidth: '480px' }}>
                        <div className="loan-modal-heading">
                            <div>
                                <h2>Record Payment Receipt</h2>
                                <p>Record money received from {recordingReceiptPayout.lenderName} for {recordingReceiptPayout.customerName}</p>
                            </div>
                            <button
                                className="loan-modal-close"
                                type="button"
                                onClick={() => setRecordingReceiptPayout(null)}
                                disabled={isSubmittingReceipt}
                            >
                                ×
                            </button>
                        </div>

                        {receiptFormError && (
                            <div className="loan-modal-error" role="alert">
                                <strong>Error: </strong>{receiptFormError}
                            </div>
                        )}

                        {receiptWarning && (
                            <div className="tieup-notice" role="alert" style={{ marginBottom: '12px' }}>
                                ⚠️ <strong>Note: </strong>{receiptWarning}
                            </div>
                        )}

                        <form className="loan-modal-form" onSubmit={handleRecordReceiptSubmit}>
                            <label>
                                Amount Received (₹) *
                                <input
                                    required
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={receiptAmount}
                                    onChange={(e) => setReceiptAmount(e.target.value)}
                                    placeholder="Enter receipt amount"
                                    disabled={isSubmittingReceipt}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    Outstanding: {formatINR(recordingReceiptPayout.outstandingAmount)} (Expected payout incl. GST: {formatINR(recordingReceiptPayout.expectedAmount)})
                                </span>
                            </label>

                            <label>
                                Received Date *
                                <input
                                    required
                                    type="date"
                                    value={receivedDate}
                                    onChange={(e) => setReceivedDate(e.target.value)}
                                    disabled={isSubmittingReceipt}
                                />
                            </label>

                            <label>
                                Payment Reference / UTR
                                <input
                                    type="text"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    placeholder="e.g. UTR123456789 or Cheque #8821"
                                    disabled={isSubmittingReceipt}
                                />
                            </label>

                            <label>
                                Receiving Bank / Account Label
                                <input
                                    type="text"
                                    value={receivedInto}
                                    onChange={(e) => setReceivedInto(e.target.value)}
                                    placeholder='e.g. "HO current account" or "Axis current - Rajahmundry"'
                                    disabled={isSubmittingReceipt}
                                />
                                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    Short label only. NEVER enter full bank account numbers.
                                </span>
                            </label>

                            <div className="loan-modal-actions">
                                <button
                                    className="loan-button-secondary"
                                    type="button"
                                    onClick={() => setRecordingReceiptPayout(null)}
                                    disabled={isSubmittingReceipt}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="loan-button-primary"
                                    type="submit"
                                    disabled={isSubmittingReceipt}
                                >
                                    {isSubmittingReceipt ? 'Recording Payment...' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {/* Edit Payout Terms Modal */}
            {editingPayout && (
                <div className="loan-modal-backdrop" role="dialog" aria-modal="true">
                    <section className="loan-modal" style={{ maxWidth: '480px' }}>
                        <div className="loan-modal-heading">
                            <div>
                                <h2>Edit Expected Payout Terms</h2>
                                <p>Update expected amount or settlement date for {editingPayout.customerName}</p>
                            </div>
                            <button
                                className="loan-modal-close"
                                type="button"
                                onClick={() => setEditingPayout(null)}
                                disabled={isSubmittingEdit}
                            >
                                ×
                            </button>
                        </div>

                        {editFormError && (
                            <div className="loan-modal-error" role="alert">
                                <strong>Error: </strong>{editFormError}
                            </div>
                        )}

                        <form className="loan-modal-form" onSubmit={handleEditPayoutSubmit}>
                            <label>
                                Expected Payout (incl. GST) (₹) *
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    placeholder="Enter expected payout"
                                    disabled={isSubmittingEdit}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    Commission payout expected from {editingPayout.lenderName}.
                                </span>
                            </label>

                            <label>
                                Expected Date *
                                <input
                                    required
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    disabled={isSubmittingEdit}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    Editing expected date marks it as confirmed (clears estimated flag).
                                </span>
                            </label>

                            <label>
                                Internal Notes / Reason
                                <textarea
                                    rows={3}
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Reason for adjustment, revised financer terms, etc."
                                    disabled={isSubmittingEdit}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        font: 'inherit',
                                        fontSize: '13px',
                                    }}
                                />
                            </label>

                            <div className="loan-modal-actions">
                                <button
                                    className="loan-button-secondary"
                                    type="button"
                                    onClick={() => setEditingPayout(null)}
                                    disabled={isSubmittingEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="loan-button-primary"
                                    type="submit"
                                    disabled={isSubmittingEdit}
                                >
                                    {isSubmittingEdit ? 'Saving Changes...' : 'Save Payout Terms'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {/* Payout Details & History Drawer */}
            {selectedPayout && (
                <div
                    className="loan-detail-overlay"
                    onClick={() => setSelectedPayout(null)}
                >
                    <aside
                        className="loan-detail-panel"
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '460px' }}
                    >
                        <div className="loan-detail-header">
                            <div>
                                <h2>Payout: {selectedPayout.customerName}</h2>
                                <p>{selectedPayout.lenderName} • {selectedPayout.branchName}</p>
                            </div>
                            <button
                                type="button"
                                className="loan-detail-close"
                                onClick={() => setSelectedPayout(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="loan-detail-content">
                            <div className="loan-detail-row">
                                <span>Payout Type</span>
                                <strong>
                                    <span
                                        className={`payout-kind-badge ${selectedPayout.kind === 'LOAN_AMOUNT' ? 'do-amount' : 'commission'}`}
                                    >
                                        {selectedPayout.kind === 'LOAN_AMOUNT' ? 'DO amount' : 'Commission'}
                                    </span>
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Status</span>
                                <strong>
                                    <PayoutStatusBadge
                                        status={selectedPayout.status}
                                        daysOverdue={selectedPayout.daysOverdue}
                                        dateEstimated={selectedPayout.dateEstimated}
                                    />
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>{selectedPayout.kind === 'COMMISSION' ? 'Expected Payout (incl. GST)' : 'Expected DO Amount'}</span>
                                <strong>{formatINR(selectedPayout.expectedAmount)}</strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Total Received</span>
                                <strong style={{ color: selectedPayout.receivedAmount > 0 ? '#0f766e' : undefined }}>
                                    {formatINR(selectedPayout.receivedAmount)}
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Remaining Outstanding</span>
                                <strong style={{ color: selectedPayout.outstandingAmount > 0 ? '#1e40af' : '#64748b' }}>
                                    {formatINR(selectedPayout.outstandingAmount)}
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Expected Settlement Date</span>
                                <strong>
                                    {new Date(selectedPayout.expectedDate).toLocaleDateString(undefined, {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                    {selectedPayout.dateEstimated && ' (Estimated)'}
                                </strong>
                            </div>
                            {selectedPayout.notes && (
                                <div className="loan-detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                    <span>Notes</span>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#334155', background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', width: '100%' }}>
                                        {selectedPayout.notes}
                                    </p>
                                </div>
                            )}

                            {/* Payment Receipts Section */}
                            <div style={{ marginTop: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                        Payment Receipts ({selectedPayout.receipts?.length ?? 0})
                                    </span>
                                    {canManagePayout && selectedPayout.outstandingAmount > 0 && (
                                        <button
                                            type="button"
                                            className="loan-row-edit-btn"
                                            onClick={() => handleOpenReceiptModal(selectedPayout)}
                                        >
                                            + Add receipt
                                        </button>
                                    )}
                                </div>

                                {selectedPayout.receipts && selectedPayout.receipts.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {selectedPayout.receipts.map((r) => (
                                            <div
                                                key={r.id}
                                                style={{
                                                    padding: '10px 12px',
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                    <span style={{ color: '#0f766e' }}>{formatINR(r.amount)}</span>
                                                    <span style={{ color: '#64748b' }}>
                                                        {new Date(r.receivedDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {r.reference && (
                                                    <div style={{ color: '#475569', marginTop: '2px' }}>
                                                        Ref: {r.reference}
                                                    </div>
                                                )}
                                                {r.receivedInto && (
                                                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                                                        Into: {r.receivedInto}
                                                    </div>
                                                )}
                                                <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>
                                                    Recorded by {r.createdBy.firstName} {r.createdBy.lastName}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', color: '#64748b', textAlign: 'center', fontSize: '12px' }}>
                                        No receipts recorded yet.
                                    </div>
                                )}
                            </div>

                            {/* Edit History Section */}
                            <div style={{ marginTop: '20px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                                    Payout Edit History ({selectedPayout.history?.length ?? 0})
                                </span>

                                {selectedPayout.history && selectedPayout.history.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {selectedPayout.history.map((h) => (
                                            <div
                                                key={h.id}
                                                style={{
                                                    padding: '8px 10px',
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                }}
                                            >
                                                <div style={{ fontWeight: 600, color: '#334155' }}>
                                                    {h.user.firstName} {h.user.lastName} changed {h.field}
                                                </div>
                                                <div style={{ color: '#64748b', marginTop: '2px' }}>
                                                    From <s>{h.oldValue || 'none'}</s> → <strong>{h.newValue}</strong>
                                                </div>
                                                <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                                                    {new Date(h.createdAt).toLocaleString(undefined, {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short',
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', color: '#64748b', textAlign: 'center', fontSize: '11px' }}>
                                        No edits recorded.
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </section>
    );
}

export default function FinanceLoan() {
    const { user } = useAuth();
    const { selectedBranchId } = useAuth();
    const hasCcView = Boolean(
        user?.roles?.includes('SYSTEM_ADMIN') || user?.permissions?.includes('CC_VIEW'),
    );
    const [activeTab, setActiveTab] = useState<'overview' | 'tieups' | 'payouts' | 'funding'>(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const t = params.get('tab');
            if (t === 'funding' || t === 'payouts' || t === 'tieups' || t === 'overview') {
                return t;
            }
        } catch {}
        return 'overview';
    });

    useEffect(() => {
        const handleLocationChange = () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const t = params.get('tab');
                if (t === 'funding' || t === 'payouts' || t === 'tieups' || t === 'overview') {
                    setActiveTab(t);
                }
            } catch {}
        };
        window.addEventListener('popstate', handleLocationChange);
        window.addEventListener('nexus:navigate-tab', handleLocationChange);
        return () => {
            window.removeEventListener('popstate', handleLocationChange);
            window.removeEventListener('nexus:navigate-tab', handleLocationChange);
        };
    }, []);
    const [selectedApplication, setSelectedApplication] = useState<LoanApplicationRecord | null>(null);
    const [editingApplication, setEditingApplication] = useState<LoanApplicationRecord | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [activeLenders, setActiveLenders] = useState<LenderRecord[]>([]);
    const [inactiveLenders, setInactiveLenders] = useState<LenderRecord[]>([]);
    const [isLoadingActiveLenders, setIsLoadingActiveLenders] = useState(true);
    const [isLoadingInactiveLenders, setIsLoadingInactiveLenders] = useState(true);
    const [activeLendersError, setActiveLendersError] = useState<string | null>(null);
    const [inactiveLendersError, setInactiveLendersError] = useState<string | null>(null);
    const [metrics, setMetrics] = useState<LoanMetrics | null>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
    const [metricsError, setMetricsError] = useState<string | null>(null);

    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [statusError, setStatusError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        setIsLoadingActiveLenders(true);
        setActiveLendersError(null);
        apiRequest<LenderRecord[]>('/finance/lenders?isActive=true')
            .then((data) => {
                if (mounted && Array.isArray(data)) {
                    setActiveLenders(data);
                }
            })
            .catch((err: unknown) => {
                if (mounted) {
                    setActiveLendersError(
                        err instanceof Error ? err.message : 'Failed to load active lenders.',
                    );
                }
            })
            .finally(() => {
                if (mounted) {
                    setIsLoadingActiveLenders(false);
                }
            });

        setIsLoadingInactiveLenders(true);
        setInactiveLendersError(null);
        apiRequest<LenderRecord[]>('/finance/lenders?isActive=false')
            .then((data) => {
                if (mounted && Array.isArray(data)) {
                    setInactiveLenders(data);
                }
            })
            .catch((err: unknown) => {
                if (mounted) {
                    setInactiveLendersError(
                        err instanceof Error ? err.message : 'Inactive lenders could not be loaded.',
                    );
                }
            })
            .finally(() => {
                if (mounted) {
                    setIsLoadingInactiveLenders(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    const fetchMetrics = useCallback(async () => {
        setIsLoadingMetrics(true);
        setMetricsError(null);
        try {
            const query =
                selectedBranchId && selectedBranchId !== 'ALL'
                    ? `?branchId=${encodeURIComponent(selectedBranchId)}`
                    : '';
            const data = await apiRequest<LoanMetrics>(`/finance/loans/metrics${query}`);
            setMetrics(data);
        } catch (err: unknown) {
            setMetricsError(
                err instanceof Error ? err.message : 'Failed to load metrics.',
            );
        } finally {
            setIsLoadingMetrics(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics, refreshTrigger]);

    const handleApplicationCreated = (newLoan: LoanApplicationRecord) => {
        setShowModal(false);
        setActiveTab('overview');
        setRefreshTrigger((prev) => prev + 1);
        setSelectedApplication(newLoan);
    };

    const handleStatusTransition = async (targetStatus: LoanStatus) => {
        if (!selectedApplication) return;
        setStatusError(null);
        setIsUpdatingStatus(true);

        try {
            const updated = await apiRequest<LoanApplicationRecord>(
                `/finance/loans/${selectedApplication.id}/status`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ status: targetStatus }),
                },
            );
            setSelectedApplication(updated);
            setRefreshTrigger((prev) => prev + 1);
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                setStatusError(err.message);
            } else if (err instanceof Error) {
                setStatusError(err.message);
            } else {
                setStatusError('Failed to update loan status.');
            }
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const allowedNextStatuses = selectedApplication
        ? ALLOWED_STATUS_TRANSITIONS[selectedApplication.status] || []
        : [];

    return (
        <div className="finance-loan-page">
            <div className="finance-loan-page-heading">
                <div>
                    <h1>Finance &amp; Loan Desk</h1>
                    <p>
                        Lender comparison, application tracking, sanction, disbursement and commission reconciliation.
                    </p>
                </div>
                <button
                    className="loan-button-primary new-finance-button"
                    type="button"
                    onClick={() => setShowModal(true)}
                >
                    + New Finance Application
                </button>
            </div>

            <div className="loan-tabs" role="tablist" aria-label="Finance loan sections">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'overview'}
                    className={`loan-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <span className="loan-tab-icon">📊</span> Overview
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'tieups'}
                    className={`loan-tab ${activeTab === 'tieups' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tieups')}
                >
                    <span className="loan-tab-icon">🏦</span> Bank-wise Tie-ups
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'payouts'}
                    className={`loan-tab ${activeTab === 'payouts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payouts')}
                >
                    <span className="loan-tab-icon">💰</span> Payout Tracker
                </button>
                {hasCcView && (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'funding'}
                        className={`loan-tab ${activeTab === 'funding' ? 'active' : ''}`}
                        onClick={() => setActiveTab('funding')}
                    >
                        <span className="loan-tab-icon">💳</span> CC / Funding
                    </button>
                )}
            </div>

            {activeTab === 'overview' ? (
                <OverviewTab
                    metrics={metrics}
                    isLoadingMetrics={isLoadingMetrics}
                    metricsError={metricsError}
                    onRetryMetrics={fetchMetrics}
                    onNewApplication={() => setShowModal(true)}
                    onSelectApplication={(application) => {
                        setSelectedApplication(application);
                        setStatusError(null);
                    }}
                    onEditApplication={(application) => {
                        setEditingApplication(application);
                    }}
                    refreshTrigger={refreshTrigger}
                    lenders={activeLenders}
                />
            ) : activeTab === 'tieups' ? (
                <BankTieUpsTab
                    metrics={metrics}
                    isLoadingMetrics={isLoadingMetrics}
                    metricsError={metricsError}
                    activeLenders={activeLenders}
                    inactiveLenders={inactiveLenders}
                    isLoadingActiveLenders={isLoadingActiveLenders}
                    isLoadingInactiveLenders={isLoadingInactiveLenders}
                    activeLendersError={activeLendersError}
                    inactiveLendersError={inactiveLendersError}
                />
            ) : activeTab === 'funding' && hasCcView ? (
                <FundingTab />
            ) : (
                <PayoutTrackerTab
                    lenders={activeLenders}
                    refreshTrigger={refreshTrigger}
                    onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
                />
            )}

            {showModal && (
                <FinanceApplicationModal
                    onClose={() => setShowModal(false)}
                    onSuccess={handleApplicationCreated}
                    lenders={activeLenders}
                />
            )}

            {editingApplication && (
                <EditLoanModal
                    application={editingApplication}
                    isOpen={Boolean(editingApplication)}
                    onClose={() => setEditingApplication(null)}
                    onSuccess={(updated) => {
                        setEditingApplication(null);
                        setRefreshTrigger((prev) => prev + 1);
                        if (selectedApplication && selectedApplication.id === updated.id) {
                            setSelectedApplication(updated);
                        }
                    }}
                    lenders={activeLenders}
                />
            )}

            {selectedApplication && (
                <div
                    className="loan-detail-overlay"
                    onClick={() => {
                        if (!isUpdatingStatus) setSelectedApplication(null);
                    }}
                >
                    <aside
                        className="loan-detail-panel"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="loan-detail-header">
                            <div>
                                <h2>{selectedApplication.customerName}</h2>
                                <p>{selectedApplication.lenderName}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {selectedApplication.status !== 'SANCTIONED' && selectedApplication.status !== 'DISBURSED' && (
                                    <button
                                        type="button"
                                        className="loan-drawer-edit-btn"
                                        onClick={() => setEditingApplication(selectedApplication)}
                                        title="Edit loan details"
                                    >
                                        ✏️ Edit
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="loan-detail-close"
                                    onClick={() => setSelectedApplication(null)}
                                    disabled={isUpdatingStatus}
                                    aria-label="Close details"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="loan-detail-content">
                            <div className="loan-detail-row">
                                <span>Application ID</span>
                                <strong style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                    {selectedApplication.id}
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Dealership Branch</span>
                                <strong>
                                    {selectedApplication.branch?.name ||
                                        selectedApplication.branchId}
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Loan Amount</span>
                                <strong>{formatINR(selectedApplication.loanAmount)}</strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Interest Rate</span>
                                <strong>
                                    {parseFloat(String(selectedApplication.interestRate)).toFixed(2)}% p.a.
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Tenure</span>
                                <strong>{selectedApplication.tenureMonths} months</strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Lifecycle Status</span>
                                <strong>
                                    <StatusBadge status={selectedApplication.status} />
                                </strong>
                            </div>
                            <div className="loan-detail-row">
                                <span>Commission Payout</span>
                                <strong>{formatINR(selectedApplication.commissionAmount)}</strong>
                            </div>
                            {selectedApplication.submittingUser && (
                                <div className="loan-detail-row">
                                    <span>Submitted By</span>
                                    <strong>
                                        {selectedApplication.submittingUser.firstName}{' '}
                                        {selectedApplication.submittingUser.lastName}
                                    </strong>
                                </div>
                            )}

                            {/* Loan History & Lifecycle Milestones */}
                            {(() => {
                                const createdDate = new Date(selectedApplication.createdAt);
                                const fmt = (d: Date | string | null | undefined) => {
                                    if (!d) return null;
                                    return new Date(d).toLocaleString(undefined, {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                    });
                                };

                                const isSubmittedOrBeyond = [
                                    'SUBMITTED',
                                    'UNDER_REVIEW',
                                    'SANCTIONED',
                                    'DISBURSED',
                                ].includes(selectedApplication.status);

                                const isReviewOrBeyond = [
                                    'UNDER_REVIEW',
                                    'SANCTIONED',
                                    'DISBURSED',
                                ].includes(selectedApplication.status);

                                const isSanctionedOrBeyond = [
                                    'SANCTIONED',
                                    'DISBURSED',
                                ].includes(selectedApplication.status);

                                const isDisbursed = selectedApplication.status === 'DISBURSED';

                                return (
                                    <div className="loan-history-card">
                                        <div className="loan-history-header">
                                            <span className="loan-history-title">Application History &amp; Lifecycle</span>
                                        </div>
                                        <div className="loan-history-timeline">
                                            <div className="timeline-item done">
                                                <div className="timeline-dot">✓</div>
                                                <div className="timeline-content">
                                                    <span className="timeline-label">Application Created</span>
                                                    <strong className="timeline-date">{fmt(createdDate)}</strong>
                                                </div>
                                            </div>

                                            <div className={`timeline-item ${selectedApplication.submittedAt || isSubmittedOrBeyond ? 'done' : 'pending'}`}>
                                                <div className="timeline-dot">
                                                    {selectedApplication.submittedAt || isSubmittedOrBeyond ? '✓' : '○'}
                                                </div>
                                                <div className="timeline-content">
                                                    <span className="timeline-label">Submitted to Lender</span>
                                                    <strong className="timeline-date">
                                                        {selectedApplication.submittedAt
                                                            ? fmt(selectedApplication.submittedAt)
                                                            : isSubmittedOrBeyond
                                                                ? fmt(selectedApplication.createdAt)
                                                                : 'Pending submission'}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className={`timeline-item ${selectedApplication.underReviewAt || isReviewOrBeyond ? 'done' : 'pending'}`}>
                                                <div className="timeline-dot">
                                                    {selectedApplication.underReviewAt || isReviewOrBeyond ? '✓' : '○'}
                                                </div>
                                                <div className="timeline-content">
                                                    <span className="timeline-label">Under Review (Appraisal)</span>
                                                    <strong className="timeline-date">
                                                        {selectedApplication.underReviewAt
                                                            ? fmt(selectedApplication.underReviewAt)
                                                            : isReviewOrBeyond
                                                                ? fmt(selectedApplication.submittedAt || selectedApplication.createdAt)
                                                                : 'Pending review'}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className={`timeline-item ${selectedApplication.sanctionedAt || isSanctionedOrBeyond ? 'done' : 'pending'}`}>
                                                <div className="timeline-dot">
                                                    {selectedApplication.sanctionedAt || isSanctionedOrBeyond ? '✓' : '○'}
                                                </div>
                                                <div className="timeline-content">
                                                    <span className="timeline-label">Sanctioned</span>
                                                    <strong className="timeline-date">
                                                        {selectedApplication.sanctionedAt
                                                            ? fmt(selectedApplication.sanctionedAt)
                                                            : isSanctionedOrBeyond
                                                                ? fmt(selectedApplication.underReviewAt || selectedApplication.createdAt)
                                                                : 'Pending sanction'}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className={`timeline-item ${selectedApplication.disbursedAt || isDisbursed ? 'done' : 'pending'}`}>
                                                <div className="timeline-dot">
                                                    {selectedApplication.disbursedAt || isDisbursed ? '✓' : '○'}
                                                </div>
                                                <div className="timeline-content">
                                                    <span className="timeline-label">Disbursed (Payout to Dealership)</span>
                                                    <strong className="timeline-date">
                                                        {selectedApplication.disbursedAt
                                                            ? fmt(selectedApplication.disbursedAt)
                                                            : isDisbursed
                                                                ? fmt(selectedApplication.sanctionedAt || selectedApplication.createdAt)
                                                                : 'Pending disbursement'}
                                                    </strong>
                                                </div>
                                            </div>

                                            {selectedApplication.status === 'REJECTED' && (
                                                <div className="timeline-item rejected">
                                                    <div className="timeline-dot">✕</div>
                                                    <div className="timeline-content">
                                                        <span className="timeline-label">Application Rejected</span>
                                                        <strong className="timeline-date">
                                                            {selectedApplication.rejectedAt
                                                                ? fmt(selectedApplication.rejectedAt)
                                                                : fmt(selectedApplication.createdAt)}
                                                        </strong>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Status Lifecycle Transition Controls */}
                            <div className="loan-detail-actions">
                                <div className="loan-detail-actions-heading">
                                    Pipeline Actions &amp; Lifecycle Status
                                </div>

                                {statusError && (
                                    <div className="loan-action-error" role="alert">
                                        <strong>Status Update Error: </strong>
                                        {statusError}
                                    </div>
                                )}

                                {selectedApplication.status === 'DISBURSED' ? (
                                    <div className="loan-terminal-notice">
                                        ✓ This application is in terminal state (Funds Disbursed to Dealership). File is locked.
                                    </div>
                                ) : allowedNextStatuses.length > 0 ? (
                                    <div className="loan-status-btn-group">
                                        {allowedNextStatuses.map((target) => {
                                            const isReject = target === 'REJECTED';
                                            const isReopen = selectedApplication.status === 'REJECTED';
                                            const btnClass = isReject
                                                ? 'reject'
                                                : isReopen
                                                    ? 'reopen'
                                                    : 'advance';

                                            let btnLabel = `Mark as ${statusLabels[target]}`;
                                            if (target === 'SUBMITTED' && isReopen) {
                                                btnLabel = 'Re-submit Application';
                                            } else if (target === 'ENQUIRY' && isReopen) {
                                                btnLabel = 'Re-open as Enquiry';
                                            } else if (target === 'SUBMITTED') {
                                                btnLabel = 'Submit to Lender';
                                            } else if (target === 'UNDER_REVIEW') {
                                                btnLabel = 'Start Appraisal';
                                            } else if (target === 'SANCTIONED') {
                                                btnLabel = 'Issue Sanction Letter';
                                            } else if (target === 'DISBURSED') {
                                                btnLabel = 'Disburse Funds';
                                            } else if (target === 'REJECTED') {
                                                btnLabel = 'Reject Application';
                                            }

                                            const isSystemAdmin =
                                                user?.roles?.includes('SYSTEM_ADMIN') ||
                                                user?.permissions?.includes('SYSTEM_ADMIN');

                                            const isSanctionTarget = target === 'SANCTIONED';
                                            const isDisburseTarget = target === 'DISBURSED';

                                            const hasPermission =
                                                isSystemAdmin ||
                                                (isSanctionTarget
                                                    ? Boolean(user?.permissions?.includes('LOAN_APPROVE'))
                                                    : isDisburseTarget
                                                        ? Boolean(user?.permissions?.includes('LOAN_DISBURSE'))
                                                        : true);

                                            const permissionTooltip = !hasPermission
                                                ? isSanctionTarget
                                                    ? 'Requires LOAN_APPROVE permission (Finance Manager or System Admin)'
                                                    : 'Requires LOAN_DISBURSE permission (Finance Manager or System Admin)'
                                                : undefined;

                                            return (
                                                <button
                                                    key={target}
                                                    type="button"
                                                    className={`loan-action-button ${btnClass} ${!hasPermission ? 'permission-locked' : ''}`}
                                                    onClick={() => handleStatusTransition(target)}
                                                    disabled={isUpdatingStatus || !hasPermission}
                                                    title={permissionTooltip}
                                                >
                                                    {isUpdatingStatus
                                                        ? 'Updating...'
                                                        : !hasPermission
                                                            ? `🔒 ${btnLabel}`
                                                            : btnLabel}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="loan-terminal-notice">
                                        No status transitions available.
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
