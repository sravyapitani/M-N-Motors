import { useState } from 'react';
import './FinanceAccounting.css';

type AccountingTab =
    | 'Overview'
    | 'General Ledger'
    | 'Receivables (AR)'
    | 'Payables (AP)'
    | 'Journal Entries'
    | 'Bank Reconciliation'
    | 'Trial Balance'
    | 'Profit & Loss'
    | 'GST'
    | 'GST 2A/2B Reconciliation'
    | 'Discounts'
    | 'Day Book'
    | 'Expenses'
    | 'GST Enquiry'
    | 'Integrations';

const accountingTabs: { label: AccountingTab; icon: string }[] = [
    { label: 'Overview', icon: '📊' },
    { label: 'General Ledger', icon: '🟨' },
    { label: 'Receivables (AR)', icon: '💰' },
    { label: 'Payables (AP)', icon: '📑' },
    { label: 'Journal Entries', icon: '📝' },
    { label: 'Bank Reconciliation', icon: '🏦' },
    { label: 'Trial Balance', icon: '⚖️' },
    { label: 'Profit & Loss', icon: '📈' },
    { label: 'GST', icon: '🏛️' },
    { label: 'GST 2A/2B Reconciliation', icon: '📋' },
    { label: 'Discounts', icon: '🏷️' },
    { label: 'Day Book', icon: '🗓️' },
    { label: 'Expenses', icon: '💳' },
    { label: 'GST Enquiry', icon: '🔍' },
    { label: 'Integrations', icon: '🔗' },
];

const overviewMetrics = [
    { label: 'REVENUE (6 MO.)', value: '₹5.51 Cr' },
    { label: 'NET PROFIT (6 MO.)', value: '₹42.86 L' },
    { label: 'RECEIVABLES OUTSTANDING', value: '₹74.36 L' },
    { label: 'PAYABLES OUTSTANDING', value: '₹93.58 L' },
];

function FinanceAccounting() {


    type AccountRow = {
        code: string;
        name: string;
        type: string;
    };

    const accountRows: AccountRow[] = [
        { code: '4000', name: 'Vehicle Sales Revenue', type: 'Revenue' },
        { code: '4100', name: 'Service Revenue', type: 'Revenue' },
        { code: '4200', name: 'Parts Revenue', type: 'Revenue' },
        { code: '4300', name: 'Finance & Insurance Commission', type: 'Revenue' },
        { code: '5000', name: 'Cost of Vehicles Sold', type: 'Expense' },
        { code: '5100', name: 'Cost of Parts Sold', type: 'Expense' },
        { code: '6000', name: 'Salaries & Wages', type: 'Expense' },
        { code: '6100', name: 'Rent & Utilities', type: 'Expense' },
        { code: '6200', name: 'Marketing & Advertising', type: 'Expense' },
        { code: '6300', name: 'Admin & Other Overheads', type: 'Expense' },
        { code: '1000', name: 'Cash & Bank', type: 'Asset' },
        { code: '1100', name: 'Accounts Receivable', type: 'Asset' },
        { code: '1200', name: 'Vehicle Inventory', type: 'Asset' },
        { code: '2000', name: 'Accounts Payable', type: 'Liability' },
        { code: '2100', name: 'GST Payable', type: 'Liability' },
        { code: '3000', name: "Owner's Equity & Retained Earnings", type: 'Equity' },
    ];


    function AgingPanel({
        title,
        values,
    }: {
        title: string;
        values: { label: string; amount: number; color: string }[];
    }) {
        const maxAmount = Math.max(...values.map((item) => item.amount), 1);

        return (
            <section className="accounting-panel accounting-aging-panel">
                <h2>{title}</h2>
                <div className="accounting-aging-chart">
                    {values.map((item) => (
                        <div className="accounting-aging-item" key={item.label}>
                            <div className="accounting-aging-label">
                                <span>{item.label}</span>
                                <strong>
                                    ₹{(item.amount / 100000).toFixed(2)} L
                                </strong>
                            </div>
                            <div className="accounting-aging-track">
                                <div
                                    className="accounting-aging-bar"
                                    style={{
                                        width: `${(item.amount / maxAmount) * 100}%`,
                                        backgroundColor: item.color,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }


    function ChartOfAccounts({
        onOpenLedger,
    }: {
        onOpenLedger: (account: AccountRow) => void;
    }) {
        return (
            <section className="accounting-panel accounting-chart-panel">
                <div className="accounting-panel-heading">
                    <h2>Chart of Accounts</h2>
                    <span>Click an account to open its ledger</span>
                </div>

                <div className="accounting-table-wrapper">
                    <table className="accounting-table">
                        <thead>
                            <tr>
                                <th>CODE</th>
                                <th>ACCOUNT</th>
                                <th>TYPE</th>
                            </tr>
                        </thead>

                        <tbody>
                            {accountRows.map((account) => (
                                <tr
                                    key={account.code}
                                    onClick={() => onOpenLedger(account)}
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') onOpenLedger(account);
                                    }}
                                >
                                    <td>{account.code}</td>
                                    <td className="accounting-account-name">{account.name}</td>
                                    <td>
                                        <span
                                            className={`accounting-type-badge accounting-type-${account.type.toLowerCase()}`}
                                        >
                                            <span className="accounting-type-dot" />
                                            {account.type}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    }


    const [activeTab, setActiveTab] = useState<AccountingTab>('Overview');
    const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null);

    const handleOpenLedger = (account: AccountRow) => {
        setSelectedAccount(account);
        setActiveTab('General Ledger');
    };

    return (
        <div className="accounting-page">
            <div className="accounting-page-heading">
                <div>
                    <h1>Finance &amp; Accounting</h1>
                    <p>
                        General ledger, AR/AP, journals, GST, bank reconciliation and
                        financial statements — a complete accounting system.
                    </p>
                </div>

                <div className="accounting-heading-actions">
                    <button
                        type="button"
                        className="accounting-button accounting-button-secondary"
                        onClick={() => window.print()}
                    >
                        Export Report
                    </button>
                    <button
                        type="button"
                        className="accounting-button accounting-button-primary"
                        onClick={() => setActiveTab('Journal Entries')}
                    >
                        + New Journal
                    </button>
                </div>
            </div>

            <nav className="accounting-tabs" aria-label="Accounting sections">
                {accountingTabs.map((tab) => (
                    <button
                        type="button"
                        key={tab.label}
                        className={`accounting-tab ${activeTab === tab.label ? 'accounting-tab-active' : ''
                            }`}
                        onClick={() => setActiveTab(tab.label)}
                    >
                        <span className="accounting-tab-icon" aria-hidden="true">
                            {tab.icon}
                        </span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className="accounting-content">
                {activeTab === 'Overview' ? (
                    <section className="accounting-overview">
                        <div className="accounting-metrics-grid">
                            {overviewMetrics.map((metric) => (
                                <article className="accounting-metric-card" key={metric.label}>
                                    <span className="accounting-metric-label">
                                        {metric.label}
                                    </span>
                                    <strong className="accounting-metric-value">
                                        {metric.value}
                                    </strong>
                                </article>
                            ))}
                        </div>

                        <div className="accounting-overview-panels">

                            <AgingPanel
                                title="Receivables Aging"
                                values={[
                                    { label: 'Current', amount: 3340000, color: '#1d4ed8' },
                                    { label: '1–30 days', amount: 4096000, color: '#1d4ed8' },
                                    { label: '31–60 days', amount: 0, color: '#1d4ed8' },
                                    { label: '60+ days', amount: 0, color: '#1d4ed8' },
                                ]}
                            />



                            <AgingPanel
                                title="Payables Aging"
                                values={[
                                    { label: 'Not Yet Due', amount: 6733000, color: '#a16b08' },
                                    { label: '1–30 days', amount: 2625000, color: '#a16b08' },
                                    { label: '31–60 days', amount: 0, color: '#a16b08' },
                                    { label: '60+ days', amount: 0, color: '#a16b08' },
                                ]}
                            />

                        </div>


                        <ChartOfAccounts onOpenLedger={handleOpenLedger} />

                    </section>
                ) : activeTab === 'General Ledger' ? (

                    <section className="accounting-ledger">
                        <div className="accounting-ledger-toolbar">
                            <label htmlFor="ledger-account">Account:</label>
                            <select
                                id="ledger-account"
                                className="accounting-ledger-select"
                                value={selectedAccount?.code ?? '4000'}
                                onChange={(event) => {
                                    const account = accountRows.find(
                                        (item) => item.code === event.target.value
                                    );
                                    if (account) setSelectedAccount(account);
                                }}
                            >
                                {accountRows.map((account) => (
                                    <option key={account.code} value={account.code}>
                                        {account.code} — {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="accounting-ledger-metrics">
                            <article className="accounting-ledger-metric">
                                <span>ACCOUNT TYPE</span>
                                <strong>
                                    {selectedAccount?.type ?? 'Revenue'}
                                </strong>
                            </article>

                            <article className="accounting-ledger-metric">
                                <span>ENTRIES</span>
                                <strong>5</strong>
                            </article>

                            <article className="accounting-ledger-metric">
                                <span>NORMAL BALANCE</span>
                                <strong>
                                    {selectedAccount?.type === 'Asset' ||
                                        selectedAccount?.type === 'Expense'
                                        ? 'Debit'
                                        : 'Credit'}
                                </strong>
                            </article>

                            <article className="accounting-ledger-metric">
                                <span>CLOSING BALANCE</span>
                                <strong>₹39,429</strong>
                            </article>
                        </div>

                        <div className="accounting-ledger-table-wrapper">
                            <table className="accounting-ledger-table">
                                <thead>
                                    <tr>
                                        <th>DATE</th>
                                        <th>ENTRY</th>
                                        <th>BRANCH</th>
                                        <th>DEBIT</th>
                                        <th>CREDIT</th>
                                        <th>BALANCE</th>
                                        <th>NARRATION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>03 Jun</td>
                                        <td>JE-24F</td>
                                        <td>Gachibowli</td>
                                        <td>—</td>
                                        <td>₹3,44,346</td>
                                        <td>₹3,44,346</td>
                                        <td>Vendor payment</td>
                                    </tr>
                                    <tr>
                                        <td>18 Jun</td>
                                        <td>JE-251</td>
                                        <td>Whitefield</td>
                                        <td>—</td>
                                        <td>—</td>
                                        <td>₹3,44,346</td>
                                        <td>Bank reconciliation adj.</td>
                                    </tr>
                                    <tr>
                                        <td>08 Aug</td>
                                        <td>JE-248</td>
                                        <td>Gachibowli</td>
                                        <td>—</td>
                                        <td>—</td>
                                        <td>₹3,44,346</td>
                                        <td>Invoice settlement</td>
                                    </tr>
                                    <tr>
                                        <td>11 Aug</td>
                                        <td>JE-24B</td>
                                        <td>Gachibowli</td>
                                        <td>—</td>
                                        <td>—</td>
                                        <td>₹3,44,346</td>
                                        <td>Utility payment</td>
                                    </tr>
                                    <tr>
                                        <td>11 Aug</td>
                                        <td>JE-240</td>
                                        <td>Gachibowli</td>
                                        <td>₹3,83,775</td>
                                        <td>—</td>
                                        <td>₹39,429</td>
                                        <td>Monthly accrual</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>




                ) : activeTab === 'Receivables (AR)' ? (
                    <ReceivablesSection />
                ) : activeTab === 'Payables (AP)' ? (
                    <PayablesSection />
                ) : activeTab === 'Journal Entries' ? (
                    <JournalEntriesSection />

                ) : activeTab === 'Bank Reconciliation' ? (
                    <BankReconciliationSection />
                ) : activeTab === 'Trial Balance' ? (
                    <TrialBalanceSection />
                ) : activeTab === 'Profit & Loss' ? (
                    <ProfitLossSection />
                ) : activeTab === 'GST' ? (
                    <GSTSection />
                ) : activeTab === 'GST 2A/2B Reconciliation' ? (
                    <GSTReconciliationSection />
                ) : activeTab === 'Discounts' ? (
                    <DiscountsSection />
                ) : activeTab === 'Day Book' ? (
                    <DayBookSection />
                ) : activeTab === 'Expenses' ? (
                    <ExpensesSection />
                ) : activeTab === 'GST Enquiry' ? (
                    <GSTEnquirySection />
                ) : activeTab === 'Integrations' ? (
                    <IntegrationsSection />
                ) : (





                    <section className="accounting-panel accounting-section-placeholder">
                        <h2>{activeTab}</h2>
                        <p>
                            This section will be implemented in its corresponding part.
                        </p>
                    </section>
                )}

            </div>
        </div>
    );
}

export default FinanceAccounting;

type ReceivableInvoice = {
    invoice: string;
    customer: string;
    type: string;
    branch: string;
    amount: string;
    dueDate: string;
    status: 'Partially Paid' | 'Overdue' | 'Paid';
};

const receivableInvoices: ReceivableInvoice[] = [
    { invoice: 'INV-S-1II', customer: 'Nair Infra Movers', type: 'Vehicle Sale', branch: 'Anna Nagar', amount: '₹7,25,765', dueDate: '15 Aug', status: 'Partially Paid' },
    { invoice: 'INV-J-1RU', customer: 'Isha Subramaniam', type: 'Service', branch: 'Vashi', amount: '₹16,854', dueDate: '15 Aug', status: 'Partially Paid' },
    { invoice: 'INV-J-1S6', customer: 'Karthik Sharma', type: 'Service', branch: 'Sector 18', amount: '₹17,734', dueDate: '17 Aug', status: 'Overdue' },
    { invoice: 'INV-J-1SU', customer: 'Pooja Patil', type: 'Service', branch: 'Gachibowli', amount: '₹5,310', dueDate: '19 Aug', status: 'Partially Paid' },
    { invoice: 'INV-J-1RW', customer: 'Iyer Courier Services', type: 'Service', branch: 'Sector 18', amount: '₹13,991', dueDate: '20 Aug', status: 'Overdue' },
    { invoice: 'INV-J-1SV', customer: 'Dev Patil', type: 'Service', branch: 'Whitefield', amount: '₹10,619', dueDate: '21 Aug', status: 'Partially Paid' },
    { invoice: 'INV-S-1ID', customer: 'Sunita Patil', type: 'Vehicle Sale', branch: 'Anna Nagar', amount: '₹3,89,918', dueDate: '22 Aug', status: 'Partially Paid' },
    { invoice: 'INV-S-1I7', customer: 'Nair Infra Movers', type: 'Vehicle Sale', branch: 'Anna Nagar', amount: '₹7,22,533', dueDate: '23 Aug', status: 'Partially Paid' },
    { invoice: 'INV-S-1I9', customer: 'Karthik Deshmukh', type: 'Vehicle Sale', branch: 'Whitefield', amount: '₹11,55,388', dueDate: '23 Aug', status: 'Overdue' },
    { invoice: 'INV-S-1IB', customer: 'Priya Khan', type: 'Vehicle Sale', branch: 'Sector 18', amount: '₹6,57,633', dueDate: '23 Aug', status: 'Partially Paid' },

    { invoice: 'INV-J-12A', customer: 'Amit Sharma', type: 'Service', branch: 'Vashi', amount: '₹12,450', dueDate: '24 Aug', status: 'Overdue' },
    { invoice: 'INV-S-12B', customer: 'Meera Motors', type: 'Vehicle Sale', branch: 'Anna Nagar', amount: '₹4,25,000', dueDate: '25 Aug', status: 'Partially Paid' },
    { invoice: 'INV-J-12C', customer: 'Rahul Patil', type: 'Service', branch: 'Sector 18', amount: '₹8,750', dueDate: '26 Aug', status: 'Paid' },
    { invoice: 'INV-S-12D', customer: 'Shree Auto', type: 'Vehicle Sale', branch: 'Whitefield', amount: '₹5,80,000', dueDate: '27 Aug', status: 'Partially Paid' },
    { invoice: 'INV-J-12E', customer: 'Sneha Kulkarni', type: 'Service', branch: 'Gachibowli', amount: '₹9,200', dueDate: '28 Aug', status: 'Overdue' },
    { invoice: 'INV-S-12F', customer: 'Om Sai Motors', type: 'Vehicle Sale', branch: 'Anna Nagar', amount: '₹6,10,000', dueDate: '29 Aug', status: 'Partially Paid' },
    { invoice: 'INV-J-12G', customer: 'Kiran Desai', type: 'Service', branch: 'Vashi', amount: '₹14,500', dueDate: '30 Aug', status: 'Paid' },
    { invoice: 'INV-S-12H', customer: 'Galaxy Wheels', type: 'Vehicle Sale', branch: 'Sector 18', amount: '₹7,45,000', dueDate: '31 Aug', status: 'Overdue' },
    { invoice: 'INV-J-12I', customer: 'Pooja Enterprises', type: 'Service', branch: 'Whitefield', amount: '₹6,800', dueDate: '01 Sep', status: 'Partially Paid' },
    { invoice: 'INV-S-12J', customer: 'City Motors', type: 'Vehicle Sale', branch: 'Gachibowli', amount: '₹5,25,000', dueDate: '02 Sep', status: 'Paid' },
    { invoice: 'INV-J-12K', customer: 'Nitin Joshi', type: 'Service', branch: 'Anna Nagar', amount: '₹11,300', dueDate: '03 Sep', status: 'Overdue' },
    { invoice: 'INV-S-12L', customer: 'Prime Auto Hub', type: 'Vehicle Sale', branch: 'Vashi', amount: '₹6,90,000', dueDate: '04 Sep', status: 'Partially Paid' },
    { invoice: 'INV-J-12M', customer: 'Riya Shah', type: 'Service', branch: 'Sector 18', amount: '₹7,500', dueDate: '05 Sep', status: 'Paid' },
];




function ReceivablesSection() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);

    const filteredInvoices = receivableInvoices.filter((invoice) => {
        const matchesSearch = [
            invoice.invoice,
            invoice.customer,
            invoice.type,
            invoice.branch,
        ].some((value) => value.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus =
            statusFilter === 'All' || invoice.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
    const visibleInvoices = filteredInvoices.slice(
        (page - 1) * pageSize,
        page * pageSize,
    );

    return (
        <section className="accounting-receivables">
            <div className="accounting-metrics-grid">
                {[
                    { label: 'TOTAL OUTSTANDING', value: '₹74.36 L' },
                    { label: 'OVERDUE', value: '₹33.82 L' },
                    { label: 'OPEN INVOICES', value: '23' },
                    { label: 'CURRENT (NOT DUE)', value: '₹33.40 L' },
                ].map((metric) => (
                    <article className="accounting-metric-card" key={metric.label}>
                        <span className="accounting-metric-label">{metric.label}</span>
                        <strong className="accounting-metric-value">{metric.value}</strong>
                    </article>
                ))}
            </div>

            <section className="accounting-panel accounting-ar-aging">
                <h2>Aging Summary</h2>
                {[
                    { label: 'Current', amount: '₹33.40 L', width: '75%' },
                    { label: '1–30 days', amount: '₹40.96 L', width: '91%' },
                    { label: '31–60 days', amount: '₹0', width: '0%' },
                    { label: '60+ days', amount: '₹0', width: '0%' },
                ].map((item) => (
                    <div className="accounting-ar-aging-item" key={item.label}>
                        <div className="accounting-aging-label">
                            <span>{item.label}</span>
                            <strong>{item.amount}</strong>
                        </div>
                        <div className="accounting-aging-track">
                            <div
                                className="accounting-aging-bar"
                                style={{ width: item.width, backgroundColor: '#1d4ed8' }}
                            />
                        </div>
                    </div>
                ))}
            </section>

            <div className="accounting-ar-toolbar">
                <input
                    type="search"
                    value={search}
                    placeholder="⌕  Search..."
                    aria-label="Search receivables"
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />

                <select
                    value={statusFilter}
                    aria-label="Filter invoice status"
                    onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">Status: All</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Paid">Paid</option>
                </select>

                <span>{filteredInvoices.length === 10 && !search && statusFilter === 'All' ? '23 records' : `${filteredInvoices.length} records`}</span>
            </div>

            <div className="accounting-ar-table-card">
                <div className="accounting-table-wrapper">
                    <table className="accounting-table accounting-ar-table">
                        <thead>
                            <tr>
                                <th>INVOICE</th>
                                <th>CUSTOMER</th>
                                <th>TYPE</th>
                                <th>BRANCH</th>
                                <th>AMOUNT</th>
                                <th>DUE DATE</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleInvoices.map((invoice) => (
                                <tr key={invoice.invoice}>
                                    <td>{invoice.invoice}</td>
                                    <td>{invoice.customer}</td>
                                    <td>{invoice.type}</td>
                                    <td>{invoice.branch}</td>
                                    <td className="accounting-ar-amount">{invoice.amount}</td>
                                    <td>{invoice.dueDate}</td>
                                    <td>

                                        <span
                                            className={`accounting-ar-status accounting-ar-status-${invoice.status.toLowerCase().replace(' ', '-')}`}
                                        >
                                            <span className="accounting-ar-status-dot" />
                                            {invoice.status}
                                        </span>

                                    </td>
                                </tr>
                            ))}
                            {visibleInvoices.length === 0 && (
                                <tr>
                                    <td colSpan={7}>No invoices match your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="accounting-ar-pagination">
                    <span>Page {page} of {totalPages}</span>
                    <div>
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            ← Prev
                        </button>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}





type PayableBill = {
    bill: string;
    vendor: string;
    branch: string;
    amount: string;
    dueDate: string;
    status: 'Overdue' | 'Paid' | 'Pending Approval';
};

const payableBills: PayableBill[] = [
    { bill: 'VB-27H', vendor: 'Precision Components Ltd', branch: 'Vashi', amount: '₹1,39,620', dueDate: '19 Aug', status: 'Overdue' },
    { bill: 'VB-27A', vendor: 'AutoParts Direct', branch: 'Gachibowli', amount: '₹24,85,350', dueDate: '21 Aug', status: 'Overdue' },
    { bill: 'VB-277', vendor: 'AutoParts Direct', branch: 'Sector 18', amount: '₹8,31,810', dueDate: '28 Aug', status: 'Paid' },
    { bill: 'VB-278', vendor: 'MetroCast Industries', branch: 'Sector 18', amount: '₹3,55,108', dueDate: '29 Aug', status: 'Paid' },
    { bill: 'VB-27C', vendor: 'RapidParts Wholesale', branch: 'Whitefield', amount: '₹2,39,316', dueDate: '30 Aug', status: 'Paid' },
    { bill: 'VB-27G', vendor: 'RapidParts Wholesale', branch: 'Sector 18', amount: '₹13,87,937', dueDate: '02 Sept', status: 'Pending Approval' },
    { bill: 'VB-279', vendor: 'MetroCast Industries', branch: 'Whitefield', amount: '₹70,114', dueDate: '06 Sept', status: 'Pending Approval' },
    { bill: 'VB-27B', vendor: 'AutoParts Direct', branch: 'Whitefield', amount: '₹30,37,650', dueDate: '09 Sept', status: 'Pending Approval' },
    { bill: 'VB-27E', vendor: 'Precision Components Ltd', branch: 'Sector 18', amount: '₹22,37,114', dueDate: '11 Sept', status: 'Pending Approval' },
    { bill: 'VB-27F', vendor: 'Nationwide Auto Supply', branch: 'Whitefield', amount: '₹15,43,990', dueDate: '12 Sept', status: 'Paid' },
    { bill: 'VB-27D', vendor: 'MetroCast Industries', branch: 'Vashi', amount: '₹8,50,000', dueDate: '15 Sept', status: 'Pending Approval' },
];

function PayablesSection() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);

    const filteredBills = payableBills.filter((bill) => {
        const matchesSearch = [
            bill.bill,
            bill.vendor,
            bill.branch,
            bill.status,
        ].some((value) =>
            value.toLowerCase().includes(search.toLowerCase())
        );

        const matchesStatus =
            statusFilter === 'All' || bill.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const pageSize = 10;
    const totalPages = Math.max(
        1,
        Math.ceil(filteredBills.length / pageSize)
    );

    const visibleBills = filteredBills.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    return (
        <section className="accounting-payables">
            <div className="accounting-metrics-grid">
                {[
                    { label: 'TOTAL PAYABLE', value: '₹93.58 L' },
                    { label: 'OVERDUE', value: '₹26.25 L' },
                    { label: 'OPEN BILLS', value: '6' },
                    { label: 'PAID (ALL TIME)', value: '₹32.27 L' },
                ].map((metric) => (
                    <article className="accounting-metric-card" key={metric.label}>
                        <span className="accounting-metric-label">
                            {metric.label}
                        </span>
                        <strong className="accounting-metric-value">
                            {metric.value}
                        </strong>
                    </article>
                ))}
            </div>

            <section className="accounting-panel accounting-ap-aging">
                <h2>Payables Aging</h2>

                {[
                    { label: 'Not Yet Due', amount: '₹67.33 L', width: '91%' },
                    { label: '1-30 days', amount: '₹26.25 L', width: '34%' },
                    { label: '31-60 days', amount: '₹0', width: '0%' },
                    { label: '60+ days', amount: '₹0', width: '0%' },
                ].map((item) => (
                    <div className="accounting-ap-aging-item" key={item.label}>
                        <div className="accounting-aging-label">
                            <span>{item.label}</span>
                            <strong>{item.amount}</strong>
                        </div>

                        <div className="accounting-aging-track">
                            <div
                                className="accounting-aging-bar accounting-ap-aging-bar"
                                style={{ width: item.width }}
                            />
                        </div>
                    </div>
                ))}
            </section>

            <div className="accounting-ap-toolbar">
                <input
                    type="search"
                    value={search}
                    placeholder="⌕  Search..."
                    aria-label="Search payable bills"
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />

                <select
                    value={statusFilter}
                    aria-label="Filter bill status"
                    onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">Status: All</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending Approval">Pending Approval</option>
                </select>

                <span>{filteredBills.length} records</span>
            </div>

            <div className="accounting-ap-table-card">
                <div className="accounting-table-wrapper">
                    <table className="accounting-table accounting-ap-table">
                        <thead>
                            <tr>
                                <th>BILL</th>
                                <th>VENDOR</th>
                                <th>BRANCH</th>
                                <th>AMOUNT</th>
                                <th>DUE DATE</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>

                        <tbody>
                            {visibleBills.map((bill) => (
                                <tr key={bill.bill}>
                                    <td>{bill.bill}</td>
                                    <td>{bill.vendor}</td>
                                    <td>{bill.branch}</td>
                                    <td className="accounting-ap-amount">{bill.amount}</td>
                                    <td>{bill.dueDate}</td>
                                    <td>
                                        <span
                                            className={`accounting-ap-status accounting-ap-status-${bill.status.toLowerCase().replace(' ', '-')}`}
                                        >
                                            <span className="accounting-ap-status-dot" />
                                            {bill.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}

                            {visibleBills.length === 0 && (
                                <tr>
                                    <td colSpan={6}>No bills match your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="accounting-ap-pagination">
                    <span>Page {page} of {totalPages}</span>

                    <div>
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() =>
                                setPage((current) => Math.max(1, current - 1))
                            }
                        >
                            ← Prev
                        </button>

                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() =>
                                setPage((current) => Math.min(totalPages, current + 1))
                            }
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}








type JournalEntry = {
    entry: string;
    date: string;
    account: string;
    branch: string;
    debit: string;
    credit: string;
    narration: string;
};

const journalEntries: JournalEntry[] = [
    { entry: 'JE-252', date: '24 Aug', account: 'Finance & Insurance Commission', branch: 'Vashi', debit: '₹8,87,925', credit: '₹3,87,398', narration: 'Customer receipt' },
    { entry: 'JE-24D', date: '19 Aug', account: 'Cost of Parts Sold', branch: 'Vashi', debit: '₹7,33,597', credit: '₹1,18,825', narration: 'Vendor payment' },
    { entry: 'JE-255', date: '19 Aug', account: 'Marketing & Advertising', branch: 'Vashi', debit: '₹5,00,950', credit: '—', narration: 'Vendor payment' },
    { entry: 'JE-23V', date: '18 Aug', account: 'Service Revenue', branch: 'Gachibowli', debit: '—', credit: '₹6,80,193', narration: 'Customer receipt' },
    { entry: 'JE-240', date: '17 Aug', account: 'Marketing & Advertising', branch: 'Sector 18', debit: '—', credit: '₹8,76,382', narration: 'Monthly accrual' },
    { entry: 'JE-247', date: '15 Aug', account: 'Vehicle Inventory', branch: 'Vashi', debit: '₹8,29,416', credit: '₹5,04,849', narration: 'Invoice settlement' },
    { entry: 'JE-253', date: '14 Aug', account: 'Cost of Vehicles Sold', branch: 'Sector 18', debit: '—', credit: '₹1,69,376', narration: 'Bank reconciliation adj.' },
    { entry: 'JE-24K', date: '12 Aug', account: 'Marketing & Advertising', branch: 'Vashi', debit: '—', credit: '₹8,53,882', narration: 'Monthly accrual' },
    { entry: 'JE-24P', date: '12 Aug', account: 'Accounts Receivable', branch: 'Gachibowli', debit: '—', credit: '—', narration: 'Monthly accrual' },
    { entry: 'JE-24B', date: '11 Aug', account: 'Vehicle Sales Revenue', branch: 'Gachibowli', debit: '—', credit: '—', narration: 'Utility payment' },
    { entry: 'JE-246', date: '09 Aug', account: 'Service Revenue', branch: 'Sector 18', debit: '₹6,54,966', credit: '₹27,399', narration: 'Utility payment' },
    { entry: 'JE-248', date: '08 Aug', account: 'Accounts Payable', branch: 'Whitefield', debit: '₹2,50,000', credit: '—', narration: 'Vendor adjustment' },
    { entry: 'JE-249', date: '07 Aug', account: 'Cash & Bank', branch: 'Vashi', debit: '—', credit: '₹1,25,000', narration: 'Bank reconciliation adj.' },
    { entry: 'JE-250', date: '06 Aug', account: 'Rent & Utilities', branch: 'Sector 18', debit: '₹45,000', credit: '—', narration: 'Monthly accrual' },
    { entry: 'JE-251', date: '05 Aug', account: 'Service Revenue', branch: 'Gachibowli', debit: '—', credit: '₹3,25,000', narration: 'Customer receipt' },
];

function JournalEntriesSection() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const filteredEntries = journalEntries.filter((item) =>
        [
            item.entry,
            item.date,
            item.account,
            item.branch,
            item.narration,
        ].some((value) =>
            value.toLowerCase().includes(search.toLowerCase())
        )
    );

    const pageSize = 10;
    const totalPages = Math.max(
        1,
        Math.ceil(filteredEntries.length / pageSize)
    );

    const visibleEntries = filteredEntries.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    return (
        <section className="accounting-journals">
            <div className="accounting-journals-heading">
                <h2>All Journal Entries</h2>
                <span>60 entries</span>
            </div>

            <div className="accounting-journals-toolbar">
                <input
                    type="search"
                    placeholder="⌕  Search..."
                    value={search}
                    aria-label="Search journal entries"
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />

                <span>{filteredEntries.length === 15 && !search ? '60 records' : `${filteredEntries.length} records`}</span>

                <button
                    type="button"
                    onClick={() => window.alert('New Journal form will be added in the next step.')}
                >
                    + New Journal
                </button>
            </div>

            <div className="accounting-journals-table-card">
                <div className="accounting-table-wrapper">
                    <table className="accounting-table accounting-journals-table">
                        <thead>
                            <tr>
                                <th>ENTRY</th>
                                <th>DATE</th>
                                <th>ACCOUNT</th>
                                <th>BRANCH</th>
                                <th>DEBIT</th>
                                <th>CREDIT</th>
                                <th>NARRATION</th>
                            </tr>
                        </thead>

                        <tbody>
                            {visibleEntries.map((item) => (
                                <tr key={item.entry}>
                                    <td>{item.entry}</td>
                                    <td>{item.date}</td>
                                    <td>{item.account}</td>
                                    <td>{item.branch}</td>
                                    <td>{item.debit}</td>
                                    <td>{item.credit}</td>
                                    <td className="accounting-journals-narration">
                                        {item.narration}
                                    </td>
                                </tr>
                            ))}

                            {visibleEntries.length === 0 && (
                                <tr>
                                    <td colSpan={7}>No journal entries match your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="accounting-journals-pagination">
                    <span>Page {page} of {totalPages}</span>

                    <div>
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() =>
                                setPage((current) => Math.max(1, current - 1))
                            }
                        >
                            ← Prev
                        </button>

                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() =>
                                setPage((current) => Math.min(totalPages, current + 1))
                            }
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}









type BankTransaction = {
    date: string;
    description: string;
    branch: string;
    type: 'Debit' | 'Credit';
    amount: string;
    reconciled: 'Matched' | 'Unmatched';
};

const bankTransactions: BankTransaction[] = [
    { date: '13 Sept', description: 'Payment — AutoParts Direct (PO-1XB)', branch: 'Anna Nagar', type: 'Debit', amount: '₹2,56,737', reconciled: 'Unmatched' },
    { date: '12 Sept', description: 'Payment — Nationwide Auto Supply (PO-1XE)', branch: 'Sector 18', type: 'Debit', amount: '₹15,43,990', reconciled: 'Matched' },
    { date: '30 Aug', description: 'Payment — RapidParts Wholesale (PO-1X9)', branch: 'Whitefield', type: 'Debit', amount: '₹2,39,316', reconciled: 'Matched' },
    { date: '29 Aug', description: 'Payment — MetroCast Industries (PO-1WX)', branch: 'Gachibowli', type: 'Debit', amount: '₹3,55,108', reconciled: 'Matched' },
    { date: '28 Aug', description: 'Payment — AutoParts Direct (PO-1WW)', branch: 'Sector 18', type: 'Debit', amount: '₹8,31,810', reconciled: 'Matched' },
    { date: '23 Aug', description: 'Repairs & Maintenance — Swift Cab Services', branch: 'Gachibowli', type: 'Debit', amount: '₹10,999', reconciled: 'Unmatched' },
    { date: '22 Aug', description: 'Receipt — Zoya Kapoor (INV-S-1I8)', branch: 'Vashi', type: 'Credit', amount: '₹11,46,186', reconciled: 'Matched' },
    { date: '22 Aug', description: 'NEFT — unidentified sender', branch: 'Gachibowli', type: 'Credit', amount: '₹20,469', reconciled: 'Unmatched' },
    { date: '21 Aug', description: 'Staff Salaries — Payroll Run', branch: 'Vashi', type: 'Debit', amount: '₹2,86,425', reconciled: 'Matched' },
    { date: '21 Aug', description: 'POS settlement batch', branch: 'Gachibowli', type: 'Debit', amount: '₹5,204', reconciled: 'Unmatched' },
    { date: '21 Aug', description: 'NEFT — unidentified sender', branch: 'Anna Nagar', type: 'Credit', amount: '₹26,754', reconciled: 'Unmatched' },
    { date: '20 Aug', description: 'Repairs & Maintenance — Petty Cash', branch: 'Whitefield', type: 'Debit', amount: '₹38,235', reconciled: 'Matched' },
    { date: '18 Aug', description: 'NEFT — unidentified sender', branch: 'Anna Nagar', type: 'Credit', amount: '₹7,052', reconciled: 'Unmatched' },
    { date: '17 Aug', description: 'Service payment — Workshop', branch: 'Vashi', type: 'Debit', amount: '₹18,500', reconciled: 'Matched' },
    { date: '16 Aug', description: 'Customer receipt — Vehicle sale', branch: 'Sector 18', type: 'Credit', amount: '₹4,25,000', reconciled: 'Matched' },

    { date: '15 Aug', description: 'Bank charges — Monthly fee', branch: 'Anna Nagar', type: 'Debit', amount: '₹2,500', reconciled: 'Unmatched' },
    { date: '14 Aug', description: 'NEFT — unidentified sender', branch: 'Vashi', type: 'Credit', amount: '₹15,200', reconciled: 'Unmatched' },
    { date: '13 Aug', description: 'Insurance payment — Fleet', branch: 'Whitefield', type: 'Debit', amount: '₹12,450', reconciled: 'Unmatched' },
    { date: '12 Aug', description: 'Cash deposit — Branch counter', branch: 'Gachibowli', type: 'Credit', amount: '₹35,000', reconciled: 'Unmatched' },
    { date: '11 Aug', description: 'Vendor payment — Parts supplier', branch: 'Sector 18', type: 'Debit', amount: '₹42,000', reconciled: 'Unmatched' },
    { date: '10 Aug', description: 'NEFT — unidentified sender', branch: 'Anna Nagar', type: 'Credit', amount: '₹8,750', reconciled: 'Unmatched' },
    { date: '09 Aug', description: 'Repair expense — Workshop', branch: 'Vashi', type: 'Debit', amount: '₹6,800', reconciled: 'Unmatched' }
];

function BankReconciliationSection() {
    const [unmatchedSearch, setUnmatchedSearch] = useState('');
    const [transactionSearch, setTransactionSearch] = useState('');
    const [unmatchedPage, setUnmatchedPage] = useState(1);
    const [transactionPage, setTransactionPage] = useState(1);

    const unmatchedTransactions = bankTransactions.filter(
        (item) => item.reconciled === 'Unmatched'
    );

    const filteredUnmatched = unmatchedTransactions.filter((item) =>
        [item.date, item.description, item.type, item.branch, item.amount]
            .some((value) =>
                value.toLowerCase().includes(unmatchedSearch.toLowerCase())
            )
    );

    const filteredTransactions = bankTransactions.filter((item) =>
        [item.date, item.description, item.branch, item.type, item.amount, item.reconciled]
            .some((value) =>
                value.toLowerCase().includes(transactionSearch.toLowerCase())
            )
    );

    const pageSize = 6;

    const unmatchedPages = Math.max(
        1,
        Math.ceil(filteredUnmatched.length / pageSize)
    );

    const transactionPages = Math.max(
        1,
        Math.ceil(filteredTransactions.length / pageSize)
    );

    const visibleUnmatched = filteredUnmatched.slice(
        (unmatchedPage - 1) * pageSize,
        unmatchedPage * pageSize
    );

    const visibleTransactions = filteredTransactions.slice(
        (transactionPage - 1) * pageSize,
        transactionPage * pageSize
    );

    return (
        <section className="accounting-bank-reconciliation">
            <div className="accounting-metrics-grid">
                {[
                    { label: 'BANK STATEMENT BALANCE', value: '₹4.09 Cr' },
                    { label: 'MATCHED TRANSACTIONS', value: '113' },
                    { label: 'UNMATCHED ITEMS', value: '22' },
                    { label: 'UNMATCHED VALUE', value: '₹11.62 L' },
                ].map((metric) => (
                    <div className="accounting-metric-card" key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                    </div>
                ))}
            </div>

            <section className="accounting-bank-unmatched">
                <h2>⚠ Needs Reconciliation</h2>

                <div className="accounting-bank-toolbar">
                    <input
                        type="search"
                        placeholder="⌕  Search..."
                        value={unmatchedSearch}
                        aria-label="Search unmatched transactions"
                        onChange={(event) => {
                            setUnmatchedSearch(event.target.value);
                            setUnmatchedPage(1);
                        }}
                    />
                    <span>{unmatchedSearch ? filteredUnmatched.length : 22} records</span>
                </div>

                <div className="accounting-bank-table-wrapper">
                    <table className="accounting-bank-table">
                        <thead>
                            <tr>
                                <th>DATE</th>
                                <th>DESCRIPTION</th>
                                <th>TYPE</th>
                                <th>AMOUNT</th>
                                <th>BRANCH</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleUnmatched.map((item, index) => (
                                <tr key={`${item.date}-${item.description}-${index}`}>
                                    <td>{item.date}</td>
                                    <td>{item.description}</td>
                                    <td>{item.type}</td>
                                    <td className="accounting-bank-amount">{item.amount}</td>
                                    <td>{item.branch}</td>
                                </tr>
                            ))}
                            {visibleUnmatched.length === 0 && (
                                <tr>
                                    <td colSpan={5}>No unmatched transactions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="accounting-bank-pagination">
                    <span>Page {unmatchedPage} of {unmatchedPages}</span>
                    <div>
                        <button
                            type="button"
                            disabled={unmatchedPage === 1}
                            onClick={() => setUnmatchedPage((p) => Math.max(1, p - 1))}
                        >
                            ← Prev
                        </button>
                        <button
                            type="button"
                            disabled={unmatchedPage >= unmatchedPages}
                            onClick={() => setUnmatchedPage((p) => Math.min(unmatchedPages, p + 1))}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </section>

            <section className="accounting-bank-all">
                <div className="accounting-bank-all-heading">
                    <h2>All Bank Transactions</h2>
                    <span>{filteredTransactions.length} records</span>
                </div>

                <div className="accounting-bank-toolbar">
                    <input
                        type="search"
                        placeholder="⌕  Search..."
                        value={transactionSearch}
                        aria-label="Search all bank transactions"
                        onChange={(event) => {
                            setTransactionSearch(event.target.value);
                            setTransactionPage(1);
                        }}
                    />
                </div>

                <div className="accounting-bank-all-card">
                    <div className="accounting-bank-table-wrapper">
                        <table className="accounting-bank-table accounting-bank-all-table">
                            <thead>
                                <tr>
                                    <th>DATE</th>
                                    <th>DESCRIPTION</th>
                                    <th>BRANCH</th>
                                    <th>TYPE</th>
                                    <th>AMOUNT</th>
                                    <th>RECONCILED</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTransactions.map((item, index) => (
                                    <tr key={`${item.date}-${item.description}-${index}`}>
                                        <td>{item.date}</td>
                                        <td>{item.description}</td>
                                        <td>{item.branch}</td>
                                        <td>{item.type}</td>
                                        <td className="accounting-bank-amount">{item.amount}</td>
                                        <td>
                                            <span
                                                className={`accounting-bank-status ${item.reconciled === 'Matched'
                                                    ? 'accounting-bank-status-matched'
                                                    : 'accounting-bank-status-unmatched'
                                                    }`}
                                            >
                                                <span className="accounting-bank-status-dot" />
                                                {item.reconciled}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {visibleTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={6}>No transactions match your search.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="accounting-bank-pagination">
                        <span>Page {transactionPage} of {transactionPages}</span>
                        <div>
                            <button
                                type="button"
                                disabled={transactionPage === 1}
                                onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                            >
                                ← Prev
                            </button>
                            <button
                                type="button"
                                disabled={transactionPage >= transactionPages}
                                onClick={() => setTransactionPage((p) => Math.min(transactionPages, p + 1))}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </section>
    );
}



type TrialBalanceRow = {
    code: string;
    account: string;
    type: string;
    debit: string;
    credit: string;
};

const trialBalanceRows: TrialBalanceRow[] = [
    { code: '1000', account: 'Cash & Bank', type: 'Asset', debit: '₹4,03,30,244', credit: '—' },
    { code: '1100', account: 'Accounts Receivable', type: 'Asset', debit: '₹74,36,258', credit: '—' },
    { code: '1200', account: 'Vehicle Inventory', type: 'Asset', debit: '₹8,28,83,566', credit: '—' },
    { code: '2000', account: 'Accounts Payable', type: 'Liability', debit: '—', credit: '₹93,57,785' },
    { code: '2100', account: 'GST Payable', type: 'Liability', debit: '—', credit: '₹40,73,246' },
    { code: '4000', account: 'Vehicle Sales Revenue', type: 'Revenue', debit: '—', credit: '₹5,40,20,654' },
    { code: '4100', account: 'Service Revenue', type: 'Revenue', debit: '—', credit: '₹3,25,809' },
    { code: '4200', account: 'Parts Revenue', type: 'Revenue', debit: '—', credit: '₹5,53,969' },
    { code: '4300', account: 'Finance & Insurance Commission', type: 'Revenue', debit: '—', credit: '₹2,31,537' },
    { code: '5000', account: 'Cost of Vehicles Sold', type: 'Expense', debit: '₹4,42,96,936', credit: '—' },
    { code: '5100', account: 'Cost of Parts Sold', type: 'Expense', debit: '₹3,76,699', credit: '—' },
    { code: '6000', account: 'Salaries & Wages', type: 'Expense', debit: '₹18,79,891', credit: '—' },
    { code: '6100', account: 'Rent & Utilities', type: 'Expense', debit: '₹15,64,761', credit: '—' },
    { code: '6200', account: 'Marketing & Advertising', type: 'Expense', debit: '₹16,71,413', credit: '—' },
    { code: '6300', account: 'Admin & Other Overheads', type: 'Expense', debit: '₹10,56,014', credit: '—' },
    { code: '3000', account: "Owner's Equity & Retained Earnings", type: 'Equity', debit: '—', credit: '₹11,29,32,782' },
];

function TrialBalanceSection() {
    return (
        <section className="accounting-trial-balance">
            <div className="accounting-trial-summary">
                <div className="accounting-trial-summary-card">
                    <span>Total Debit</span>
                    <strong>₹18,14,95,782</strong>
                </div>

                <div className="accounting-trial-summary-card">
                    <span>Total Credit</span>
                    <strong>₹18,14,95,782</strong>
                </div>

                <div className="accounting-trial-summary-card">

                    <span className="accounting-trial-balanced">
                        <span className="accounting-trial-check">✓</span>
                        Balanced
                    </span>

                </div>
            </div>

            <div className="accounting-trial-table-wrapper">
                <table className="accounting-trial-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Account</th>
                            <th>Type</th>
                            <th>Debit</th>
                            <th>Credit</th>
                        </tr>
                    </thead>


                    <tbody>
                        {trialBalanceRows.map((row) => (
                            <tr key={row.code}>
                                <td>{row.code}</td>
                                <td>{row.account}</td>
                                <td>
                                    <span className={`accounting-trial-badge ${row.type.toLowerCase()}`}>
                                        <span>●</span> {row.type}
                                    </span>
                                </td>
                                <td>{row.debit}</td>
                                <td>{row.credit}</td>
                            </tr>
                        ))}


                    </tbody>


                    <tfoot>
                        <tr className="accounting-trial-total-row">
                            <td colSpan={3}>Total</td>
                            <td>₹18,14,95,782</td>
                            <td>₹18,14,95,782</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );
}








type ProfitLossRow = {
    label: string;
    amount?: string;
    category?: boolean;
    total?: boolean;
};

const profitLossRows: ProfitLossRow[] = [
    { label: 'Revenue', category: true },
    { label: 'Vehicle Sales Revenue', amount: '₹5,40,20,654' },
    { label: 'Service Revenue', amount: '₹3,25,809' },
    { label: 'Parts Revenue', amount: '₹5,53,969' },
    { label: 'Finance & Insurance Commission', amount: '₹2,31,537' },
    { label: 'Total Revenue', amount: '₹5,51,31,969', total: true },
    { label: 'Cost of Goods Sold', category: true },
    { label: 'Cost of Vehicles Sold', amount: '₹4,42,96,936' },
    { label: 'Cost of Parts Sold', amount: '₹3,76,699' },
    { label: 'Gross Profit', amount: '₹1,04,58,334', total: true },
    { label: 'Operating Expenses', category: true },
    { label: 'Salaries & Wages', amount: '₹18,79,891' },
    { label: 'Rent & Utilities', amount: '₹15,64,761' },
    { label: 'Marketing & Advertising', amount: '₹16,71,413' },
    { label: 'Admin & Other Overheads', amount: '₹10,56,014' },
    { label: 'Net Profit', amount: '₹42,86,255', total: true },
];

function ProfitLossSection() {
    return (
        <section className="accounting-profit-loss">
            <div className="accounting-pl-metrics">
                {[
                    { label: 'TOTAL REVENUE', value: '₹5.51 Cr' },
                    { label: 'GROSS PROFIT', value: '₹1.05 Cr' },
                    { label: 'NET PROFIT', value: '₹42.86 L' },
                    { label: 'NET MARGIN', value: '7.8%' },
                ].map((metric) => (
                    <div className="accounting-pl-metric-card" key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                    </div>
                ))}
            </div>

            <section className="accounting-pl-statement">
                <div className="accounting-pl-heading">
                    <h3>Profit &amp; Loss Statement</h3>
                    <span>Trailing period, current branch scope</span>
                </div>

                <table className="accounting-pl-table">
                    <tbody>
                        {profitLossRows.map((row) => (
                            <tr
                                key={row.label}
                                className={[
                                    row.category ? 'category-row' : '',
                                    row.total ? 'total-row' : '',
                                    row.label === 'Net Profit' ? 'net-profit-row' : '',
                                ].filter(Boolean).join(' ')}
                            >
                                <td>{row.label}</td>
                                <td>{row.amount ?? ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </section>
    );
}










type GSTMonthlyRow = {
    month: string;
    output: string;
    input: string;
    payable: string;
};

type GSTInvoiceRow = {
    invoice: string;
    customer: string;
    type: string;
    taxable: string;
    tax: string;
    date: string;
};

const gstMonthlyRows: GSTMonthlyRow[] = [
    { month: "Mar '26", output: '₹9,03,893', input: '₹0', payable: '₹9,03,893' },
    { month: "Apr '26", output: '₹10,69,368', input: '₹0', payable: '₹10,69,368' },
    { month: "May '26", output: '₹11,69,574', input: '₹0', payable: '₹11,69,574' },
    { month: "Jun '26", output: '₹5,76,483', input: '₹0', payable: '₹5,76,483' },
    { month: "Jul '26", output: '₹9,68,434', input: '₹6,14,506', payable: '₹3,53,928' },
    { month: "Aug '26", output: '₹1,52,309', input: '₹13,05,200', payable: '₹0' },
];

const gstInvoiceRows: GSTInvoiceRow[] = [
    { invoice: 'INV-S-1I8', customer: 'Zoya Kapoor', type: 'Vehicle Sale', taxable: '₹10,05,426', tax: '₹1,40,760', date: '22 Aug' },
    { invoice: 'INV-J-1RK', customer: 'Aarav Subramanian', type: 'Service', taxable: '₹13,242', tax: '₹2,907', date: '18 Aug' },
    { invoice: 'INV-J-1T4', customer: 'Kapoor Supply Chain Co.', type: 'Service', taxable: '₹9,399', tax: '₹2,063', date: '11 Aug' },
    { invoice: 'INV-J-1R0', customer: 'Ananya Mehta', type: 'Service', taxable: '₹14,430', tax: '₹3,167', date: '04 Aug' },
    { invoice: 'INV-J-1S7', customer: 'Lakshmi Kulkarni', type: 'Service', taxable: '₹15,545', tax: '₹3,412', date: '01 Aug' },
    { invoice: 'INV-J-1SB', customer: 'Ritika Verma', type: 'Service', taxable: '₹13,437', tax: '₹2,949', date: '31 Jul' },
    { invoice: 'INV-J-1SU', customer: 'Pooja Patil', type: 'Service', taxable: '₹4,354', tax: '₹956', date: '30 Jul' },
    { invoice: 'INV-J-1RH', customer: 'Riya Menon', type: 'Service', taxable: '₹16,711', tax: '₹3,668', date: '26 Jul' },
    { invoice: 'INV-S-1IU', customer: 'Sameer Menon', type: 'Vehicle Sale', taxable: '₹3,45,975', tax: '₹48,436', date: '25 Jul' },
    { invoice: 'INV-J-1RV', customer: 'Arjun Bose', type: 'Service', taxable: '₹5,900', tax: '₹1,295', date: '22 Jul' },
];

function GSTSection() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const filteredInvoices = gstInvoiceRows.filter((row) =>
        [row.invoice, row.customer, row.type, row.date]
            .some((value) => value.toLowerCase().includes(search.toLowerCase()))
    );

    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
    const visibleInvoices = filteredInvoices.slice((page - 1) * pageSize, page * pageSize);

    return (
        <section className="accounting-gst">
            <div className="accounting-gst-metrics">
                {[
                    { label: 'OUTPUT GST (SALES)', value: '₹48.40 L' },
                    { label: 'INPUT TAX CREDIT', value: '₹19.20 L' },
                    { label: 'NET GST PAYABLE', value: '₹40.73 L' },
                    { label: 'PERIOD COVERED', value: '6 months' },
                ].map((metric) => (
                    <div className="accounting-gst-metric-card" key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                    </div>
                ))}
            </div>

            <section className="accounting-gst-monthly">
                <div className="accounting-gst-heading">
                    <h3>Monthly GST Summary</h3>
                    <span>GSTR-3B style — output tax vs. input tax credit</span>
                </div>

                <table className="accounting-gst-table">
                    <thead>
                        <tr>
                            <th>MONTH</th>
                            <th>OUTPUT GST</th>
                            <th>INPUT TAX CREDIT</th>
                            <th>NET PAYABLE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gstMonthlyRows.map((row) => (
                            <tr key={row.month}>
                                <td>{row.month}</td>
                                <td>{row.output}</td>
                                <td>{row.input}</td>
                                <td>{row.payable}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="accounting-gst-invoices">
                <h3>Invoice-wise GST Breakup</h3>

                <div className="accounting-gst-toolbar">
                    <input
                        type="search"
                        placeholder="⌕  Search..."
                        aria-label="Search GST invoices"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                    />
                    <span>{search ? filteredInvoices.length : 10} records</span>
                </div>

                <div className="accounting-gst-invoice-card">
                    <div className="accounting-gst-table-scroll">
                        <table className="accounting-gst-table accounting-gst-invoice-table">
                            <thead>
                                <tr>
                                    <th>INVOICE</th>
                                    <th>CUSTOMER</th>
                                    <th>TYPE</th>
                                    <th>TAXABLE VALUE</th>
                                    <th>GST / TAX</th>
                                    <th>DATE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleInvoices.map((row) => (
                                    <tr key={row.invoice}>
                                        <td className="accounting-gst-invoice-number">{row.invoice}</td>
                                        <td>{row.customer}</td>
                                        <td>{row.type}</td>
                                        <td>{row.taxable}</td>
                                        <td>{row.tax}</td>
                                        <td>{row.date}</td>
                                    </tr>
                                ))}
                                {visibleInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="accounting-gst-empty">
                                            No matching invoices found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="accounting-gst-pagination">
                        <span>Page {page} of {totalPages}</span>
                        <div>
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                ← Prev
                            </button>
                            <button
                                type="button"
                                disabled={page === totalPages}
                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </section>
    );
}





type GSTReconciliationRow = {
    vendor: string;
    branch: string;
    period: string;
    books: string;
    gstr2a: string;
    gstr2b: string;
    status: 'Matched' | 'Amount Mismatch' | 'Not Yet in 2B' | 'Vendor Not Filed (Missing in 2A)';
};

const gstReconciliationRows: GSTReconciliationRow[] = [
    { vendor: 'AutoParts Direct', branch: 'Sector 18', period: 'Q2 FY27', books: '₹1,26,886', gstr2a: '₹1,26,886', gstr2b: '₹1,26,886', status: 'Matched' },
    { vendor: 'MetroCast Industries', branch: 'Sector 18', period: 'Q2 FY27', books: '₹54,169', gstr2a: '₹54,169', gstr2b: '₹54,169', status: 'Matched' },
    { vendor: 'MetroCast Industries', branch: 'Whitefield', period: 'Q2 FY27', books: '₹10,695', gstr2a: '₹10,695', gstr2b: '₹10,695', status: 'Matched' },
    { vendor: 'AutoParts Direct', branch: 'Gachibowli', period: 'Q2 FY27', books: '₹3,79,121', gstr2a: '₹4,24,616', gstr2b: '₹4,24,616', status: 'Amount Mismatch' },
    { vendor: 'AutoParts Direct', branch: 'Gachibowli', period: 'Q2 FY27', books: '₹4,63,370', gstr2a: '₹4,63,370', gstr2b: '₹4,63,370', status: 'Matched' },
    { vendor: 'RapidParts Wholesale', branch: 'Whitefield', period: 'Q2 FY27', books: '₹36,506', gstr2a: '₹32,125', gstr2b: '₹32,125', status: 'Amount Mismatch' },
    { vendor: 'AutoParts Direct', branch: 'Anna Nagar', period: 'Q2 FY27', books: '₹39,163', gstr2a: '₹39,163', gstr2b: '₹39,163', status: 'Matched' },
    { vendor: 'Precision Components Ltd', branch: 'Sector 18', period: 'Q2 FY27', books: '₹3,41,255', gstr2a: '₹3,41,255', gstr2b: '₹3,41,255', status: 'Matched' },
    { vendor: 'Nationwide Auto Supply', branch: 'Anna Nagar', period: 'Q2 FY27', books: '₹2,35,524', gstr2a: '₹2,35,524', gstr2b: '₹2,35,524', status: 'Matched' },
    { vendor: 'RapidParts Wholesale', branch: 'Gachibowli', period: 'Q2 FY27', books: '₹2,11,719', gstr2a: '₹2,11,719', gstr2b: '₹2,11,719', status: 'Matched' },
    { vendor: 'Precision Components Ltd', branch: 'Vashi', period: 'Q2 FY27', books: '₹21,298', gstr2a: '₹21,298', gstr2b: '₹0', status: 'Not Yet in 2B' },
];

function GSTReconciliationSection() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);

    const filteredRows = gstReconciliationRows.filter((row) => {
        const matchesSearch = [
            row.vendor,
            row.branch,
            row.period,
            row.status,
        ].some((value) =>
            value.toLowerCase().includes(search.toLowerCase())
        );

        const matchesStatus =
            statusFilter === 'All' || row.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const pageSize = 10;
    const totalPages = Math.max(
        1,
        Math.ceil(filteredRows.length / pageSize)
    );

    const visibleRows = filteredRows.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    const matchedCount = gstReconciliationRows.filter(
        (row) => row.status === 'Matched'
    ).length;

    const mismatchCount = gstReconciliationRows.filter(
        (row) => row.status === 'Amount Mismatch'
    ).length;

    const notIn2BCount = gstReconciliationRows.filter(
        (row) => row.status === 'Not Yet in 2B'
    ).length;

    return (
        <section className="accounting-gstr-reconciliation">
            <section className="accounting-gstr-summary">

                <div className="accounting-gstr-title-row">
                    <h2>Input Tax Credit — Books vs. GSTR-2A vs. GSTR-2B</h2>
                    <p className="accounting-gstr-subtitle">
                        Purchase register reconciled against vendor-filed 2A and the static monthly 2B statement
                    </p>
                </div>



                <div className="accounting-gstr-metrics">
                    {[
                        { label: 'ITC AS PER BOOKS', value: '₹19.20 L' },
                        { label: 'ITC AS PER GSTR-2A', value: '₹19.61 L' },
                        { label: 'ITC AS PER GSTR-2B', value: '₹19.40 L' },
                        { label: 'ITC AT RISK (MISMATCHED)', value: '₹4.37 L' },
                    ].map((metric) => (
                        <article className="accounting-gstr-metric-card" key={metric.label}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                        </article>
                    ))}
                </div>
            </section>

            <div className="accounting-gstr-analysis">
                <section className="accounting-gstr-status-panel">
                    <h2>Reconciliation Status Mix</h2>

                    <div className="accounting-gstr-chart-content">
                        <div
                            className="accounting-gstr-donut"
                            style={{
                                background: `conic-gradient(#1d4ed8 0% ${(matchedCount / gstReconciliationRows.length) * 100}%, #0d9488 ${(matchedCount / gstReconciliationRows.length) * 100}% ${((matchedCount + mismatchCount) / gstReconciliationRows.length) * 100}%, #a16b08 ${((matchedCount + mismatchCount) / gstReconciliationRows.length) * 100}% 100%)`,
                            }}
                        >
                            <div className="accounting-gstr-donut-hole">
                                <strong>{gstReconciliationRows.length}</strong>
                                <span>vendor bills</span>
                            </div>
                        </div>

                        <div className="accounting-gstr-legend">
                            <div><span className="gstr-legend-blue" /> Matched <strong>{matchedCount}</strong></div>
                            <div><span className="gstr-legend-teal" /> Amount Mismatch <strong>{mismatchCount}</strong></div>
                            <div><span className="gstr-legend-gold" /> Not Yet in 2B <strong>{notIn2BCount}</strong></div>
                        </div>
                    </div>
                </section>

                <section className="accounting-gstr-meaning-panel">
                    <h2>What Each Status Means</h2>

                    <div className="accounting-gstr-meaning-row">
                        <span className="accounting-gstr-status matched">● Matched</span>
                        <p>Books, 2A and 2B all agree — ITC is safe to claim.</p>
                    </div>

                    <div className="accounting-gstr-meaning-row">
                        <span className="accounting-gstr-status missing">● Vendor Not Filed (Missing in 2A)</span>
                        <p>The vendor hasn't filed their GSTR-1 yet — ITC cannot be claimed until they do.</p>
                    </div>

                    <div className="accounting-gstr-meaning-row">
                        <span className="accounting-gstr-status mismatch">● Amount Mismatch</span>
                        <p>2A/2B value differs from the books — needs vendor follow-up before filing.</p>
                    </div>

                    <div className="accounting-gstr-meaning-row">
                        <span className="accounting-gstr-status not-in-2b">● Not Yet in 2B</span>
                        <p>Present in 2A but not yet rolled into this period's static 2B statement.</p>
                    </div>
                </section>
            </div>

            <section className="accounting-gstr-vendors">
                <div className="accounting-gstr-vendors-heading">
                    <h2>Vendor-wise Reconciliation</h2>
                    <span>
                        {filteredRows.filter((row) => row.status !== 'Matched').length}
                        {' '}bill(s) need attention before this period's GSTR-3B is filed
                    </span>
                </div>

                <div className="accounting-gstr-toolbar">
                    <input
                        type="search"
                        placeholder="⌕  Search..."
                        aria-label="Search vendors"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <select
                        aria-label="Filter reconciliation status"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="All">Status: All</option>
                        <option value="Matched">Matched</option>
                        <option value="Amount Mismatch">Amount Mismatch</option>
                        <option value="Not Yet in 2B">Not Yet in 2B</option>
                        <option value="Vendor Not Filed (Missing in 2A)">Vendor Not Filed (Missing in 2A)</option>
                    </select>

                    <span>{filteredRows.length === 11 && !search && statusFilter === 'All' ? '11 records' : `${filteredRows.length} records`}</span>
                </div>

                <div className="accounting-gstr-table-card">
                    <div className="accounting-table-wrapper">
                        <table className="accounting-table accounting-gstr-table">
                            <thead>
                                <tr>
                                    <th>VENDOR</th>
                                    <th>BRANCH</th>
                                    <th>PERIOD</th>
                                    <th>BOOKS</th>
                                    <th>GSTR-2A</th>
                                    <th>GSTR-2B</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((row, index) => (
                                    <tr key={`${row.vendor}-${row.branch}-${index}`}>
                                        <td>{row.vendor}</td>
                                        <td>{row.branch}</td>
                                        <td>{row.period}</td>
                                        <td>{row.books}</td>
                                        <td>{row.gstr2a}</td>
                                        <td>{row.gstr2b}</td>
                                        <td>
                                            <span className={`accounting-gstr-status ${row.status === 'Matched'
                                                ? 'matched'
                                                : row.status === 'Amount Mismatch'
                                                    ? 'mismatch'
                                                    : row.status === 'Not Yet in 2B'
                                                        ? 'not-in-2b'
                                                        : 'missing'
                                                }`}>
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>No matching vendor bills found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="accounting-gstr-pagination">
                            <span>
                                Page {page} of {totalPages}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    disabled={page === 1}
                                    onClick={() =>
                                        setPage((current) => Math.max(1, current - 1))
                                    }
                                >
                                    ← Prev
                                </button>

                                <button
                                    type="button"
                                    disabled={page === totalPages}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.min(totalPages, current + 1)
                                        )
                                    }
                                >
                                    Next →
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </section>
        </section>
    );
}




type DiscountDeal = {
    booking: string;
    customer: string;
    salesExec: string;
    branch: string;
    exShowroom: string;
    discount: string;
    stage: string;
};

const discountDeals: DiscountDeal[] = [
    { booking: 'BK-1GM', customer: 'Zoya Kapoor', salesExec: 'Sameer Sheikh', branch: 'Vashi', exShowroom: '₹10,32,618', discount: '₹30,000', stage: 'Delivered' },
    { booking: 'BK-1HC', customer: 'Dev Patil', salesExec: 'Pooja Bose', branch: 'Anna Nagar', exShowroom: '₹6,98,857', discount: '₹25,000', stage: 'Cancelled' },
    { booking: 'BK-1HE', customer: 'Verma Supply Chain Co.', salesExec: 'Meera Patil', branch: 'Anna Nagar', exShowroom: '₹17,76,475', discount: '₹5,000', stage: 'PDI' },
    { booking: 'BK-1HU', customer: 'Zoya Kapoor', salesExec: 'Ayesha Menon', branch: 'Gachibowli', exShowroom: '₹6,57,422', discount: '₹15,000', stage: 'Finance/Insurance' },
    { booking: 'BK-1HI', customer: 'Rao Supply Chain Co.', salesExec: 'Sunita Menon', branch: 'Anna Nagar', exShowroom: '₹3,02,555', discount: '₹15,000', stage: 'Cancelled' },
    { booking: 'BK-1H2', customer: 'Vivaan Nair', salesExec: 'Ritika Patil', branch: 'Gachibowli', exShowroom: '₹11,43,363', discount: '₹5,000', stage: 'PDI' },
    { booking: 'BK-1GS', customer: 'Sheikh Courier Services', salesExec: 'Ayesha Menon', branch: 'Gachibowli', exShowroom: '₹10,83,935', discount: '₹5,000', stage: 'PDI' },
    { booking: 'BK-1HT', customer: 'Isha Subramaniam', salesExec: 'Rohan Sheikh', branch: 'Sector 18', exShowroom: '₹6,22,582', discount: '₹30,000', stage: 'Registration' },
    { booking: 'BK-1HG', customer: 'Sameer Menon', salesExec: 'Anjali Joshi', branch: 'Anna Nagar', exShowroom: '₹3,33,989', discount: '₹5,000', stage: 'Delivered' },
    { booking: 'BK-1GQ', customer: 'Lakshmi Kulkarni', salesExec: 'Anjali Joshi', branch: 'Gachibowli', exShowroom: '₹11,61,967', discount: '₹25,000', stage: 'Allocated' },
    { booking: 'BK-1GR', customer: 'Arjun Bose', salesExec: 'Rohan Sheikh', branch: 'Vashi', exShowroom: '₹8,45,000', discount: '₹10,000', stage: 'Delivered' },
];

function DiscountsSection() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const executives = [
        { name: 'Ritika Patil', amount: '₹1.30 L', width: '91%' },
        { name: 'Nikhil Menon', amount: '₹75K', width: '51%' },
        { name: 'Vivaan Rao', amount: '₹70K', width: '48%' },
        { name: 'Dev Khan', amount: '₹65K', width: '45%' },
        { name: 'Divya Deshmukh', amount: '₹60K', width: '41%' },
        { name: 'Sameer Sheikh', amount: '₹55K', width: '38%' },
    ];

    const filteredDeals = discountDeals.filter((deal) =>
        [
            deal.booking,
            deal.customer,
            deal.salesExec,
            deal.branch,
            deal.stage,
        ].some((value) => value.toLowerCase().includes(search.toLowerCase()))
    );

    const totalPages = Math.max(1, Math.ceil(filteredDeals.length / pageSize));
    const visibleDeals = filteredDeals.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    return (
        <section className="accounting-discounts">
            <div className="accounting-discount-metrics">
                <div className="accounting-discount-metric">
                    <span>TOTAL DISCOUNT GIVEN</span>
                    <strong>₹8.60 L</strong>
                </div>
                <div className="accounting-discount-metric">
                    <span>DISCOUNTED DEALS</span>
                    <strong>51</strong>
                </div>
                <div className="accounting-discount-metric">
                    <span>AVG. DISCOUNT %</span>
                    <strong>1.7%</strong>
                </div>
                <div className="accounting-discount-metric">
                    <span>AVG. DISCOUNT / DEAL</span>
                    <strong>₹16.9K</strong>
                </div>
            </div>

            <section className="accounting-discount-executives">
                <h2>Top Discount-Approving Executives</h2>

                {executives.map((executive) => (
                    <div className="accounting-discount-executive" key={executive.name}>
                        <div className="accounting-discount-executive-info">
                            <span>{executive.name}</span>
                            <strong>{executive.amount}</strong>
                        </div>
                        <div className="accounting-discount-progress">
                            <div style={{ width: executive.width }} />
                        </div>
                    </div>
                ))}
            </section>

            <section className="accounting-discount-records">
                <div className="accounting-discount-toolbar">
                    <input
                        type="search"
                        placeholder="⌕  Search..."
                        aria-label="Search discount deals"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                    />
                    <span>{search ? filteredDeals.length : 51} records</span>
                </div>

                <div className="accounting-table-wrapper">
                    <table className="accounting-table accounting-discount-table">
                        <thead>
                            <tr>
                                <th>BOOKING</th>
                                <th>CUSTOMER</th>
                                <th>SALES EXEC</th>
                                <th>BRANCH</th>
                                <th>EX-SHOWROOM</th>
                                <th>DISCOUNT</th>
                                <th>STAGE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleDeals.map((deal) => (
                                <tr key={deal.booking}>
                                    <td>{deal.booking}</td>
                                    <td>{deal.customer}</td>
                                    <td>{deal.salesExec}</td>
                                    <td>{deal.branch}</td>
                                    <td>{deal.exShowroom}</td>
                                    <td>{deal.discount}</td>
                                    <td>
                                        <span
                                            className={`accounting-discount-stage ${deal.stage
                                                .toLowerCase()
                                                .replace(/[^a-z0-9]+/g, '-')}`}
                                        >
                                            {deal.stage}
                                        </span>
                                    </td>
                                </tr>
                            ))}

                            {visibleDeals.length === 0 && (
                                <tr>
                                    <td colSpan={7}>No matching discount deals found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="accounting-discount-pagination">
                    <span>Page {page} of {totalPages}</span>
                    <div>
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            ← Prev
                        </button>
                        <button
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </section>
        </section>
    );
}









type DayBookTransaction = {
    type: string;
    ref: string;
    particulars: string;
    debit: string;
    credit: string;
    balance: string;
};

const dayBookTransactions: DayBookTransaction[] = [
    {
        type: 'Payment',
        ref: 'VB-277',
        particulars: 'Vendor bill — AutoParts Direct',
        debit: '₹8,31,810',
        credit: '—',
        balance: '₹-8,31,810',
    },
    {
        type: 'Payment',
        ref: 'VB-27E',
        particulars: 'Vendor bill — Precision Components Ltd',
        debit: '₹22,37,114',
        credit: '—',
        balance: '₹-30,68,924',
    },
    {
        type: 'Journal',
        ref: 'JE-252',
        particulars: 'Finance & Insurance Commission — Customer receipt',
        debit: '₹8,87,925',
        credit: '₹3,87,398',
        balance: '₹-35,69,451',
    },
];

function DayBookSection() {
    const [selectedDate, setSelectedDate] = useState('2026-08-24');

    return (
        <section className="accounting-daybook">
            <div className="accounting-daybook-date">
                <label htmlFor="daybook-date">Date:</label>
                <input
                    id="daybook-date"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                />
            </div>

            <div className="accounting-daybook-metrics">
                <div className="accounting-daybook-metric">
                    <span>TOTAL RECEIPTS</span>
                    <strong>₹3.87 L</strong>
                </div>

                <div className="accounting-daybook-metric">
                    <span>TOTAL PAYMENTS</span>
                    <strong>₹39.57 L</strong>
                </div>

                <div className="accounting-daybook-metric">
                    <span>NET CASH MOVEMENT</span>
                    <strong>₹-35.69 L</strong>
                </div>

                <div className="accounting-daybook-metric">
                    <span>TRANSACTIONS</span>
                    <strong>3</strong>
                </div>
            </div>

            <div className="accounting-table-wrapper accounting-daybook-table-wrapper">
                <table className="accounting-table accounting-daybook-table">
                    <thead>
                        <tr>
                            <th>TYPE</th>
                            <th>REF</th>
                            <th>PARTICULARS</th>
                            <th>DEBIT</th>
                            <th>CREDIT</th>
                            <th>RUNNING BALANCE</th>
                        </tr>
                    </thead>

                    <tbody>
                        {dayBookTransactions.map((transaction) => (
                            <tr key={transaction.ref}>
                                <td>
                                    <span
                                        className={`accounting-daybook-type ${transaction.type === 'Payment'
                                            ? 'payment'
                                            : 'journal'
                                            }`}
                                    >
                                        {transaction.type}
                                    </span>
                                </td>
                                <td>{transaction.ref}</td>
                                <td>{transaction.particulars}</td>
                                <td>{transaction.debit}</td>
                                <td>{transaction.credit}</td>
                                <td>{transaction.balance}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}






type ExpenseRecord = {
    entry: string;
    category: string;
    paidTo: string;
    branch: string;
    amount: string;
    date: string;
    status: 'Paid' | 'Approved' | 'Rejected' | 'Pending Approval';
};

const expenseRecords: ExpenseRecord[] = [
    { entry: 'EXP-25J', category: 'Repairs & Maintenance', paidTo: 'Swift Cab Services', branch: 'Gachibowli', amount: '₹10,999', date: '23 Aug', status: 'Paid' },
    { entry: 'EXP-259', category: 'Electricity & Utilities', paidTo: 'CoolAir HVAC Services', branch: 'Whitefield', amount: '₹1,16,638', date: '21 Aug', status: 'Rejected' },
    { entry: 'EXP-26H', category: 'Staff Salaries', paidTo: 'Payroll Run', branch: 'Vashi', amount: '₹2,86,425', date: '21 Aug', status: 'Paid' },
    { entry: 'EXP-25Z', category: 'Repairs & Maintenance', paidTo: 'Petty Cash', branch: 'Whitefield', amount: '₹38,235', date: '20 Aug', status: 'Paid' },
    { entry: 'EXP-25L', category: 'IT & Software Subscriptions', paidTo: 'CoolAir HVAC Services', branch: 'Anna Nagar', amount: '₹22,860', date: '18 Aug', status: 'Approved' },
    { entry: 'EXP-25W', category: 'Office Supplies', paidTo: 'Staples Office Supplies', branch: 'Sector 18', amount: '₹25,550', date: '15 Aug', status: 'Approved' },
    { entry: 'EXP-25Q', category: 'Insurance Premium (Business)', paidTo: 'Swift Cab Services', branch: 'Sector 18', amount: '₹24,173', date: '12 Aug', status: 'Approved' },
    { entry: 'EXP-260', category: 'IT & Software Subscriptions', paidTo: 'Staples Office Supplies', branch: 'Vashi', amount: '₹38,696', date: '10 Aug', status: 'Paid' },
    { entry: 'EXP-25E', category: 'Electricity & Utilities', paidTo: 'City Print Media', branch: 'Whitefield', amount: '₹92,433', date: '08 Aug', status: 'Paid' },
    { entry: 'EXP-25T', category: 'Digital Marketing', paidTo: 'CoolAir HVAC Services', branch: 'Anna Nagar', amount: '₹71,432', date: '08 Aug', status: 'Paid' },
    { entry: 'EXP-25U', category: 'Insurance Premium (Business)', paidTo: 'State Power Distribution Co.', branch: 'Whitefield', amount: '₹16,592', date: '08 Aug', status: 'Paid' },
    { entry: 'EXP-25P', category: 'Office Supplies', paidTo: 'United India Insurance', branch: 'Gachibowli', amount: '₹58,456', date: '06 Aug', status: 'Pending Approval' },
];

const expenseCategories = [
    { name: 'Staff Salaries', amount: '₹18.80 L', percent: 91 },
    { name: 'Rent', amount: '₹9.93 L', percent: 46 },
    { name: 'Digital Marketing', amount: '₹8.50 L', percent: 40 },
    { name: 'Print & Local Advertising', amount: '₹8.21 L', percent: 39 },
    { name: 'Electricity & Utilities', amount: '₹5.72 L', percent: 27 },
    { name: 'Repairs & Maintenance', amount: '₹3.02 L', percent: 14 },
    { name: 'Travel & Conveyance', amount: '₹2.61 L', percent: 12 },
    { name: 'IT & Software Subscriptions', amount: '₹2.56 L', percent: 12 },
];

function ExpensesSection() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseCategory, setExpenseCategory] = useState('Staff Salaries');
    const [expensePaidTo, setExpensePaidTo] = useState('');

    const pageSize = 10;

    const filteredExpenses = expenseRecords.filter((expense) => {
        const matchesSearch = [
            expense.entry,
            expense.category,
            expense.paidTo,
            expense.branch,
            expense.status,
        ].some((value) => value.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus =
            statusFilter === 'All' || expense.status === statusFilter;

        const matchesCategory =
            categoryFilter === 'All' || expense.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesCategory;
    });

    const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
    const visibleExpenses = filteredExpenses.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    return (
        <section className="accounting-expenses">
            <div className="accounting-expense-metrics">
                <div className="accounting-expense-metric">
                    <span>TOTAL EXPENSES</span>
                    <strong>₹61.72 L</strong>
                </div>
                <div className="accounting-expense-metric">
                    <span>PENDING APPROVAL</span>
                    <strong>8</strong>
                </div>
                <div className="accounting-expense-metric">
                    <span>PAID</span>
                    <strong>₹39.07 L</strong>
                </div>
                <div className="accounting-expense-metric">
                    <span>ENTRIES</span>
                    <strong>70</strong>
                </div>
            </div>

            <section className="accounting-expense-spend">
                <h2>Spend by Category</h2>

                {expenseCategories.map((category) => (
                    <div className="accounting-expense-category" key={category.name}>
                        <div className="accounting-expense-category-label">
                            <span>{category.name}</span>
                            <strong>{category.amount}</strong>
                        </div>
                        <div className="accounting-expense-track">
                            <div
                                className="accounting-expense-bar"
                                style={{ width: `${category.percent}%` }}
                            />
                        </div>
                    </div>
                ))}
            </section>

            <div className="accounting-expense-toolbar">
                <input
                    type="search"
                    placeholder="⌕  Search..."
                    aria-label="Search expenses"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />

                <select
                    aria-label="Filter by expense status"
                    value={statusFilter}
                    onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">Status: All</option>
                    <option value="Paid">Paid</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Pending Approval">Pending Approval</option>
                </select>

                <select
                    aria-label="Filter by expense category"
                    value={categoryFilter}
                    onChange={(event) => {
                        setCategoryFilter(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">Category: All</option>
                    {expenseCategories.map((category) => (
                        <option value={category.name} key={category.name}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <span className="accounting-expense-record-count">
                    {filteredExpenses.length === 12 && !search &&
                        statusFilter === 'All' && categoryFilter === 'All'
                        ? '70 records'
                        : `${filteredExpenses.length} records`}
                </span>

                <button
                    type="button"
                    className="accounting-expense-log-button"
                    onClick={() => setShowExpenseModal(true)}
                >
                    + Log Expense
                </button>
            </div>

            <div className="accounting-expense-table-card">
                <div className="accounting-table-wrapper">
                    <table className="accounting-table accounting-expense-table">
                        <thead>
                            <tr>
                                <th>ENTRY</th>
                                <th>CATEGORY</th>
                                <th>PAID TO</th>
                                <th>BRANCH</th>
                                <th>AMOUNT</th>
                                <th>DATE</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleExpenses.map((expense) => (
                                <tr key={expense.entry}>
                                    <td>{expense.entry}</td>
                                    <td>{expense.category}</td>
                                    <td>{expense.paidTo}</td>
                                    <td>{expense.branch}</td>
                                    <td>{expense.amount}</td>
                                    <td>{expense.date}</td>
                                    <td>
                                        <span
                                            className={`accounting-expense-status ${expense.status
                                                .toLowerCase()
                                                .replaceAll(' ', '-')}`}
                                        >
                                            <span>●</span> {expense.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}

                            {visibleExpenses.length === 0 && (
                                <tr>
                                    <td colSpan={7}>No matching expenses found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="accounting-expense-pagination">
                    <span>Page {page} of {totalPages}</span>
                    <div>
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            ← Prev
                        </button>
                        <button
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
            {showExpenseModal && (
                <div
                    className="accounting-expense-modal-overlay"
                    onClick={() => setShowExpenseModal(false)}
                >
                    <div
                        className="accounting-expense-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="accounting-expense-modal-header">
                            <h2>Log Expense</h2>
                            <button
                                type="button"
                                className="accounting-expense-modal-close"
                                onClick={() => setShowExpenseModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                window.alert('Expense logged successfully!');
                                setExpensePaidTo('');
                                setExpenseCategory('Staff Salaries');
                                setShowExpenseModal(false);
                            }}
                        >
                            <div className="accounting-expense-modal-body">
                                <label>
                                    Category
                                    <select
                                        value={expenseCategory}
                                        onChange={(event) => setExpenseCategory(event.target.value)}
                                    >
                                        {expenseCategories.map((category) => (
                                            <option key={category.name} value={category.name}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Paid To
                                    <input
                                        type="text"
                                        value={expensePaidTo}
                                        onChange={(event) => setExpensePaidTo(event.target.value)}
                                        placeholder="e.g. Vendor / Payee name"
                                        required
                                    />
                                </label>

                                <label>
                                    Amount (₹)
                                    <input
                                        type="number"
                                        min="1"
                                        defaultValue="5000"
                                        required
                                    />
                                </label>
                            </div>

                            <div className="accounting-expense-modal-footer">
                                <button
                                    type="button"
                                    className="accounting-expense-cancel"
                                    onClick={() => setShowExpenseModal(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="accounting-expense-submit"
                                >
                                    Log Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}









type GSTEnquiryRecord = {
    gstin: string;
    party: string;
    enquiryType: string;
    branch: string;
    result: 'Filed / Valid' | 'Pending' | 'Mismatch';
    date: string;
    queriedBy: string;
};

const gstEnquiryRecords: GSTEnquiryRecord[] = [
    { gstin: '21ABCDE2626F5Z4', party: 'Meera Sharma', enquiryType: 'GSTR-3B Filing Status', branch: 'Anna Nagar', result: 'Filed / Valid', date: '24 Aug', queriedBy: 'Arjun Menon' },
    { gstin: '29ABCDE7203F6Z1', party: 'Sharma Infra Movers', enquiryType: 'GSTR-1 Filing Status', branch: 'Anna Nagar', result: 'Filed / Valid', date: '20 Aug', queriedBy: 'Neha Joshi' },
    { gstin: '16ABCDE3789F5Z3', party: 'Ananya Mehta', enquiryType: 'GSTIN Validation', branch: 'Whitefield', result: 'Pending', date: '19 Aug', queriedBy: 'Neha Sheikh' },
    { gstin: '07ABCDE7417F6Z6', party: 'Arjun Bose', enquiryType: 'e-Invoice IRN Lookup', branch: 'Gachibowli', result: 'Filed / Valid', date: '14 Aug', queriedBy: 'Vikram Subramaniam' },
    { gstin: '29ABCDE1810F8Z6', party: 'Sharma Infra Movers', enquiryType: 'ITC Reconciliation Check', branch: 'Anna Nagar', result: 'Filed / Valid', date: '11 Aug', queriedBy: 'Vikram Subramaniam' },
    { gstin: '01ABCDE2831F7Z4', party: 'Karthik Deshmukh', enquiryType: 'GSTIN Validation', branch: 'Anna Nagar', result: 'Pending', date: '08 Aug', queriedBy: 'Lakshmi Rao' },
    { gstin: '04ABCDE6828F6Z9', party: 'Nationwide Auto Supply', enquiryType: 'ITC Reconciliation Check', branch: 'Whitefield', result: 'Filed / Valid', date: '06 Aug', queriedBy: 'Lakshmi Rao' },
    { gstin: '34ABCDE6303F6Z1', party: 'Karthik Deshmukh', enquiryType: 'GSTR-1 Filing Status', branch: 'Gachibowli', result: 'Filed / Valid', date: '04 Aug', queriedBy: 'Deepa Reddy' },
    { gstin: '18ABCDE6762F4Z2', party: 'Rao Cabs & Fleet', enquiryType: 'GSTR-1 Filing Status', branch: 'Anna Nagar', result: 'Filed / Valid', date: '02 Aug', queriedBy: 'Sanya Joshi' },
    { gstin: '01ABCDE6354F5Z7', party: 'Dev Patil', enquiryType: 'GSTR-3B Filing Status', branch: 'Sector 18', result: 'Filed / Valid', date: '28 Jul', queriedBy: 'Arjun Menon' },
    { gstin: '27ABCDE5123F1Z8', party: 'Metro Auto Parts', enquiryType: 'GSTIN Validation', branch: 'Vashi', result: 'Mismatch', date: '26 Jul', queriedBy: 'Neha Joshi' },
    { gstin: '24ABCDE8462F3Z5', party: 'City Motors', enquiryType: 'GSTR-3B Filing Status', branch: 'Whitefield', result: 'Filed / Valid', date: '24 Jul', queriedBy: 'Deepa Reddy' },
];

function GSTEnquirySection() {
    const [gstin, setGstin] = useState('');
    const [enquiryType, setEnquiryType] = useState('GSTIN Validation');
    const [search, setSearch] = useState('');
    const [resultFilter, setResultFilter] = useState('All');
    const [page, setPage] = useState(1);

    const pageSize = 10;

    const filteredRecords = gstEnquiryRecords.filter((record) => {
        const matchesSearch = [
            record.gstin,
            record.party,
            record.enquiryType,
            record.branch,
            record.queriedBy,
        ].some((value) => value.toLowerCase().includes(search.toLowerCase()));

        const matchesResult =
            resultFilter === 'All' || record.result === resultFilter;

        return matchesSearch && matchesResult;
    });

    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    const visibleRecords = filteredRecords.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    return (
        <section className="accounting-gst-enquiry">
            <div className="accounting-gst-enquiry-form">
                <div className="accounting-gst-enquiry-heading">
                    <h3>GST Portal Enquiry</h3>
                    <span>
                        Live lookup against the GST Portal — GSTIN validation, return-filing status, e-Invoice/e-Way Bill checks
                    </span>
                </div>

                <div className="accounting-gst-enquiry-fields">
                    <label>
                        GSTIN
                        <input
                            value={gstin}
                            onChange={(event) => setGstin(event.target.value.toUpperCase())}
                            placeholder="e.g. 29ABCDE1234F1Z5"
                            maxLength={15}
                        />
                    </label>

                    <label>
                        Enquiry Type
                        <select
                            value={enquiryType}
                            onChange={(event) => setEnquiryType(event.target.value)}
                        >
                            <option>GSTIN Validation</option>
                            <option>GSTR-1 Filing Status</option>
                            <option>GSTR-3B Filing Status</option>
                            <option>e-Invoice IRN Lookup</option>
                            <option>ITC Reconciliation Check</option>
                        </select>
                    </label>

                    <button
                        type="button"
                        onClick={() => {
                            if (!gstin.trim()) {
                                window.alert('Please enter a GSTIN first.');
                                return;
                            }
                            window.alert('GST Portal integration will be connected later.');
                        }}
                    >
                        Check on GST Portal →
                    </button>
                </div>
            </div>

            <div className="accounting-gst-enquiry-metrics">
                <div><span>ENQUIRIES LOGGED</span><strong>24</strong></div>
                <div><span>VALID / FILED</span><strong>18</strong></div>
                <div><span>MISMATCHES FLAGGED</span><strong>2</strong></div>
                <div><span>AVG. API TURNAROUND</span><strong>1.8 sec</strong></div>
            </div>

            <div className="accounting-gst-enquiry-list-heading">
                <h3>Recent Enquiries</h3>
            </div>

            <div className="accounting-gst-enquiry-toolbar">
                <input
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    placeholder="⌕  Search..."
                />

                <select
                    value={resultFilter}
                    onChange={(event) => {
                        setResultFilter(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">Result: All</option>
                    <option value="Filed / Valid">Filed / Valid</option>
                    <option value="Pending">Pending</option>
                    <option value="Mismatch">Mismatch</option>
                </select>

                <span>{search || resultFilter !== 'All' ? filteredRecords.length : 24} records</span>
            </div>

            <div className="accounting-gst-enquiry-table-card">
                <table className="accounting-gst-enquiry-table">
                    <thead>
                        <tr>
                            <th>GSTIN</th>
                            <th>PARTY</th>
                            <th>ENQUIRY TYPE</th>
                            <th>BRANCH</th>
                            <th>RESULT</th>
                            <th>DATE</th>
                            <th>QUERIED BY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRecords.map((record, index) => (
                            <tr key={`${record.gstin}-${index}`}>
                                <td>{record.gstin}</td>
                                <td>{record.party}</td>
                                <td>{record.enquiryType}</td>
                                <td>{record.branch}</td>
                                <td>
                                    <span className={`accounting-gst-enquiry-status ${record.result === 'Filed / Valid' ? 'valid' : record.result === 'Pending' ? 'pending' : 'mismatch'}`}>
                                        <span className="accounting-gst-enquiry-status-dot" />
                                        {record.result}
                                    </span>
                                </td>
                                <td>{record.date}</td>
                                <td>{record.queriedBy}</td>
                            </tr>
                        ))}
                        {visibleRecords.length === 0 && (
                            <tr>
                                <td colSpan={7} className="accounting-gst-enquiry-empty">
                                    No enquiries match your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="accounting-gst-enquiry-pagination">
                    <span>Page {page} of {totalPages}</span>
                    <div>
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            ← Prev
                        </button>
                        <button
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}










type IntegrationSystem = {
    name: string;
    description: string;
    icon: string;
    lastSync: string;
};

const integrationSystems: IntegrationSystem[] = [
    { name: 'Mahindra DMS', description: 'Dealer Management System sync', icon: '🚚', lastSync: '2 hrs ago' },
    { name: 'Tally ERP', description: 'Accounting ledger migration', icon: '📗', lastSync: '6 hrs ago' },
    { name: 'GST Portal (GSTN)', description: 'Returns · e-Invoice · e-Way Bill', icon: '▤', lastSync: '1 hr ago' },
    { name: 'Power BI', description: 'Executive dashboards & maps', icon: '📊', lastSync: '12 hrs ago' },
];

const integrationRuns = [
    { agent: 'Bank Reconciliation Agent', action: 'Auto-matched 42 bank transactions against invoices & vendor bills', when: '1 hr ago' },
    { agent: 'GST Compliance Agent', action: 'Flagged 1 GSTIN mismatch for manual review before GSTR-1 filing', when: '3 hrs ago' },
    { agent: 'Tally Sync Agent', action: 'Posted 18 new journal vouchers from Tally into the General Ledger', when: '5 hrs ago' },
    { agent: 'DMS Sync Agent', action: 'Pulled 6 new vehicle bookings and 3 stock intakes from Mahindra DMS', when: '7 hrs ago' },
    { agent: 'Receivables Agent', action: 'Sent 5 automated payment-reminder emails for invoices overdue 15+ days', when: '20 hrs ago' },
];

type JournalVoucher = {
    date: string;
    voucherNo: string;
    ledger: string;
    narration: string;
    debit: number;
    credit: number;
    accountCode?: string;
    accountName?: string;
    branch?: string;
};

function IntegrationsSection() {
    const [syncMessages, setSyncMessages] = useState<Record<string, string>>({});
    const [voucherRows, setVoucherRows] = useState<JournalVoucher[]>([]);
    const [fileName, setFileName] = useState('');

    const loadSampleSheet = () => {
        setVoucherRows([
            { date: '24/08/2026', voucherNo: 'JV-001', ledger: 'Cash Account', narration: 'Cash sales', debit: 25000, credit: 0 },
            { date: '24/08/2026', voucherNo: 'JV-002', ledger: 'Sales Account', narration: 'Vehicle sale', debit: 0, credit: 25000 },
            { date: '24/08/2026', voucherNo: 'JV-003', ledger: 'Bank Account', narration: 'Customer receipt', debit: 15000, credit: 0 },
            { date: '24/08/2026', voucherNo: 'JV-004', ledger: 'Receivables', narration: 'Invoice settlement', debit: 0, credit: 15000 },
        ]);
        setFileName('Sample journal voucher sheet');
    };

    const handleFile = (file?: File) => {
        if (!file) return;

        const extensionAllowed = /\.(xlsx|xls|csv)$/i.test(file.name);
        if (!extensionAllowed) {
            window.alert('Please choose an Excel (.xlsx, .xls) or CSV file.');
            return;
        }

        setFileName(file.name);
        setVoucherRows([]);
        window.alert('File selected. Full Excel/CSV parsing and ledger preview can be connected next.');
    };

    return (
        <section className="accounting-integrations">
            <div className="accounting-integrations-connected">
                <div className="accounting-integrations-section-heading">
                    <h3>Connected Systems</h3>
                    <span>Mahindra DMS · Tally · GST Portal · Power BI — bidirectional sync</span>
                </div>

                <div className="accounting-integrations-system-grid">
                    {integrationSystems.map((system) => (
                        <article className="accounting-integrations-system-card" key={system.name}>
                            <div className="accounting-integrations-system-heading">
                                <span className="accounting-integrations-system-icon">{system.icon}</span>
                                <div>
                                    <h4>{system.name}</h4>
                                    <p>{system.description}</p>
                                </div>
                            </div>

                            <div className="accounting-integrations-detail-row">
                                <span>Status</span>
                                <strong className="accounting-integrations-connected-badge">
                                    <span /> Connected
                                </strong>
                            </div>

                            <div className="accounting-integrations-detail-row">
                                <span>Last Sync</span>
                                <strong>{system.lastSync}</strong>
                            </div>

                            <div className="accounting-integrations-detail-row">
                                <span>Mode</span>
                                <strong>Automatic · every 4 hrs</strong>
                            </div>

                            {syncMessages[system.name] && (
                                <p className="accounting-integrations-sync-message">
                                    {syncMessages[system.name]}
                                </p>
                            )}

                            <button
                                type="button"
                                className="accounting-integrations-sync-button"
                                onClick={() => {
                                    setSyncMessages((current) => ({
                                        ...current,
                                        [system.name]: 'Sync request recorded (demo)',
                                    }));
                                }}
                            >
                                🔄 Sync Now
                            </button>
                        </article>
                    ))}
                </div>
            </div>

            <div className="accounting-integrations-runs">
                <div className="accounting-integrations-section-heading">
                    <h3>Agentic AI Workflow — Recent Runs</h3>
                    <span>Autonomous background agents supporting Finance &amp; Accounting</span>
                </div>

                <table className="accounting-integrations-runs-table">
                    <thead>
                        <tr>
                            <th>AGENT</th>
                            <th>ACTION TAKEN</th>
                            <th>WHEN</th>
                        </tr>
                    </thead>
                    <tbody>
                        {integrationRuns.map((run) => (
                            <tr key={run.agent}>
                                <td>{run.agent}</td>
                                <td>{run.action}</td>
                                <td>{run.when}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="accounting-integrations-import">
                <div className="accounting-integrations-section-heading">
                    <h3>Bulk Import — Tally / Excel Journal Vouchers</h3>
                    <span>Upload a Tally-exported Excel/CSV of journal vouchers and preview exactly how they will post to the ledger</span>
                </div>

                <div className="accounting-integrations-dropzone">
                    <div className="accounting-integrations-file-icon">📄 ⇢ 📊</div>
                    <strong>Drag &amp; drop an Excel or CSV file here</strong>
                    <p>.xlsx, .xls or .csv — parsed right here in the browser, nothing leaves this session</p>

                    <div className="accounting-integrations-import-actions">
                        <label className="accounting-integrations-upload-button">
                            Choose File to Upload
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={(event) => handleFile(event.target.files?.[0])}
                            />
                        </label>

                        <button
                            type="button"
                            className="accounting-integrations-sample-button"
                            onClick={loadSampleSheet}
                        >
                            ▶ Load a Sample Sheet Instead
                        </button>
                    </div>




                </div>

                {fileName && (
                    <div className="accounting-integrations-file-info">
                        <div className="accounting-integrations-file-details">
                            <span className="accounting-integrations-imported-badge">
                                ✓ Imported
                            </span>

                            <strong>
                                {fileName === 'Sample journal voucher sheet'
                                    ? 'tally_journal_export.xlsx'
                                    : fileName}
                            </strong>

                            <span className="accounting-integrations-sheet-details">
                                Sheet "Vouchers" · {voucherRows.length} rows · 7 columns
                            </span>
                        </div>

                        <button
                            type="button"
                            className="accounting-integrations-clear-button"
                            onClick={() => {
                                setVoucherRows([]);
                                setFileName('');
                            }}
                        >
                            Clear
                        </button>
                    </div>
                )}


                {voucherRows.length > 0 && (

                    <div className="accounting-integrations-preview">


                        <div className="accounting-integrations-preview-table-wrap">
                            <table className="accounting-integrations-runs-table">
                                <thead>
                                    <tr>
                                        <th>VOUCHER DATE</th>
                                        <th>ACCOUNT CODE</th>
                                        <th>ACCOUNT NAME</th>
                                        <th>DEBIT</th>
                                        <th>CREDIT</th>
                                        <th>BRANCH</th>
                                        <th>NARRATION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {voucherRows.map((row, index) => (
                                        <tr key={`${row.voucherNo}-${index}`}>
                                            <td>{row.date}</td>
                                            <td>{row.accountCode ?? '4000'}</td>
                                            <td>{row.accountName ?? row.ledger}</td>
                                            <td>{row.debit.toLocaleString('en-IN')}</td>
                                            <td>{row.credit.toLocaleString('en-IN')}</td>
                                            <td>{row.branch ?? 'BR-MUM'}</td>
                                            <td>{row.narration}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
