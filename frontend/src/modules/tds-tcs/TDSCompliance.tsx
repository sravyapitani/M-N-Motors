
import { useMemo, useState } from 'react';
import './TDSCompliance.css';

type TaxEntry = {
    id: number;
    type: 'TDS' | 'TCS';
    section: string;
    description: string;
    party: string;
    branch: string;
    baseAmount: number;
    taxAmount: number;
    date: string;
    status: string;
    certificate: string;
};

const entries: TaxEntry[] = [
    { id: 1, type: 'TDS', section: '194I', description: 'Rent', party: 'AutoParts Direct', branch: 'Sector 18', baseAmount: 831810, taxAmount: 83181, date: '24 Aug', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 2, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Zoya Kapoor', branch: 'Vashi', baseAmount: 1146186, taxAmount: 11462, date: '22 Aug', status: 'Certificate Issued', certificate: '27D/BK-1GM' },
    { id: 3, type: 'TDS', section: '194I', description: 'Rent', party: 'AutoParts Direct', branch: 'Gachibowli', baseAmount: 2485350, taxAmount: 248535, date: '06 Aug', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 4, type: 'TDS', section: '194I', description: 'Rent', party: 'Nationwide Auto Supply', branch: 'Sector 18', baseAmount: 1543990, taxAmount: 154399, date: '03 Aug', status: 'Certificate Issued', certificate: '16A/PO-1XE' },
    { id: 5, type: 'TDS', section: '194Q', description: 'Purchase of Goods (> ₹50 lakh p.a.)', party: 'RapidParts Wholesale', branch: 'Whitefield', baseAmount: 239316, taxAmount: 239, date: '20 Jul', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 6, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Karthik Deshmukh', branch: 'Whitefield', baseAmount: 1155388, taxAmount: 11554, date: '18 Jul', status: 'Certificate Issued', certificate: '27D/BK-1GO' },
    { id: 7, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Priya Khan', branch: 'Anna Nagar', baseAmount: 1294363, taxAmount: 12944, date: '11 Jul', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 8, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Karthik Kulkarni', branch: 'Whitefield', baseAmount: 2065984, taxAmount: 20660, date: '08 Jul', status: 'Collected', certificate: 'Not yet issued' },
    { id: 9, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Priya Khan', branch: 'Gachibowli', baseAmount: 1229986, taxAmount: 12300, date: '08 Jul', status: 'Certificate Issued', certificate: '27D/BK-1I1' },
    { id: 10, type: 'TDS', section: '194C', description: 'Payment to Contractors', party: 'AutoParts Direct', branch: 'Anna Nagar', baseAmount: 256737, taxAmount: 2567, date: '07 Jul', status: 'Certificate Issued', certificate: '16A/PO-1XB' },
    { id: 11, type: 'TDS', section: '194H', description: 'Commission / Brokerage', party: 'MetroCast Industries', branch: 'Sector 18', baseAmount: 355108, taxAmount: 17755, date: '03 Jul', status: 'Certificate Issued', certificate: '16A/PO-1WX' },
    { id: 12, type: 'TDS', section: '194Q', description: 'Purchase of Goods (> ₹50 lakh p.a.)', party: 'Precision Components Ltd', branch: 'Vashi', baseAmount: 139620, taxAmount: 140, date: '02 Jul', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 13, type: 'TDS', section: '194J', description: 'Professional fees', party: 'City Print Media', branch: 'Gachibowli', baseAmount: 480000, taxAmount: 48000, date: '28 Jun', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 14, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Rahul Mehta', branch: 'Vashi', baseAmount: 1480000, taxAmount: 14800, date: '26 Jun', status: 'Collected', certificate: 'Not yet issued' },
    { id: 15, type: 'TDS', section: '194C', description: 'Payment to Contractors', party: 'Swift Cab Services', branch: 'Whitefield', baseAmount: 620000, taxAmount: 6200, date: '23 Jun', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 16, type: 'TDS', section: '194I', description: 'Rent', party: 'Property Management Co.', branch: 'Anna Nagar', baseAmount: 750000, taxAmount: 75000, date: '20 Jun', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 17, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Ananya Shah', branch: 'Sector 18', baseAmount: 1750000, taxAmount: 17500, date: '18 Jun', status: 'Certificate Issued', certificate: '27D/BK-1I2' },
    { id: 18, type: 'TDS', section: '194J', description: 'Professional fees', party: 'Tech Solutions Ltd', branch: 'Gachibowli', baseAmount: 325000, taxAmount: 32500, date: '15 Jun', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 19, type: 'TDS', section: '194C', description: 'Payment to Contractors', party: 'CoolAir HVAC Services', branch: 'Vashi', baseAmount: 180000, taxAmount: 1800, date: '12 Jun', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 20, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Rohan Patel', branch: 'Whitefield', baseAmount: 1380000, taxAmount: 13800, date: '10 Jun', status: 'Collected', certificate: 'Not yet issued' },
    { id: 21, type: 'TDS', section: '194H', description: 'Commission / Brokerage', party: 'MetroCast Industries', branch: 'Anna Nagar', baseAmount: 250000, taxAmount: 12500, date: '07 Jun', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 22, type: 'TDS', section: '194I', description: 'Rent', party: 'Property Management Co.', branch: 'Sector 18', baseAmount: 680000, taxAmount: 68000, date: '04 Jun', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 23, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Neha Verma', branch: 'Gachibowli', baseAmount: 1320000, taxAmount: 13200, date: '28 May', status: 'Certificate Issued', certificate: '27D/BK-1I3' },
    { id: 24, type: 'TDS', section: '194Q', description: 'Purchase of Goods (> ₹50 lakh p.a.)', party: 'RapidParts Wholesale', branch: 'Vashi', baseAmount: 520000, taxAmount: 520, date: '25 May', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 25, type: 'TDS', section: '194C', description: 'Payment to Contractors', party: 'Swift Cab Services', branch: 'Whitefield', baseAmount: 350000, taxAmount: 3500, date: '22 May', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 26, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Aarav Singh', branch: 'Anna Nagar', baseAmount: 1650000, taxAmount: 16500, date: '19 May', status: 'Collected', certificate: 'Not yet issued' },
    { id: 27, type: 'TDS', section: '194J', description: 'Professional fees', party: 'Tech Solutions Ltd', branch: 'Sector 18', baseAmount: 410000, taxAmount: 41000, date: '16 May', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 28, type: 'TDS', section: '194I', description: 'Rent', party: 'Property Management Co.', branch: 'Gachibowli', baseAmount: 700000, taxAmount: 70000, date: '13 May', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 29, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Ishita Rao', branch: 'Vashi', baseAmount: 1420000, taxAmount: 14200, date: '10 May', status: 'Certificate Issued', certificate: '27D/BK-1I4' },
    { id: 30, type: 'TDS', section: '194C', description: 'Payment to Contractors', party: 'CoolAir HVAC Services', branch: 'Whitefield', baseAmount: 240000, taxAmount: 2400, date: '07 May', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 31, type: 'TDS', section: '194H', description: 'Commission / Brokerage', party: 'MetroCast Industries', branch: 'Anna Nagar', baseAmount: 295000, taxAmount: 14750, date: '04 May', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 32, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Kabir Joshi', branch: 'Sector 18', baseAmount: 1550000, taxAmount: 15500, date: '30 Apr', status: 'Collected', certificate: 'Not yet issued' },
    { id: 33, type: 'TDS', section: '194Q', description: 'Purchase of Goods (> ₹50 lakh p.a.)', party: 'Precision Components Ltd', branch: 'Gachibowli', baseAmount: 385000, taxAmount: 385, date: '26 Apr', status: 'Deposited', certificate: 'Not yet issued' },
    { id: 34, type: 'TDS', section: '194I', description: 'Rent', party: 'Property Management Co.', branch: 'Vashi', baseAmount: 650000, taxAmount: 65000, date: '22 Apr', status: 'Deducted', certificate: 'Not yet issued' },
    { id: 35, type: 'TCS', section: '206C(1F)', description: 'Sale of motor vehicle > ₹10 lakh', party: 'Meera Nair', branch: 'Whitefield', baseAmount: 1270000, taxAmount: 12700, date: '18 Apr', status: 'Certificate Issued', certificate: '27D/BK-1I5' },
    { id: 36, type: 'TDS', section: '194C', description: 'Payment to Contractors', party: 'Swift Cab Services', branch: 'Anna Nagar', baseAmount: 290000, taxAmount: 2900, date: '14 Apr', status: 'Deposited', certificate: 'Not yet issued' },
];

const monthlyTDS = [
    { month: "Jan '26", value: 0 },
    { month: "Feb '26", value: 0 },
    { month: "Mar '26", value: 0 },
    { month: "Apr '26", value: 0 },
    { month: "May '26", value: 0 },
    { month: "Jun '26", value: 0 },
    { month: "Jul '26", value: 20700 },
    { month: "Aug '26", value: 486000 },
];

const monthlyTCS = [
    { month: "Jan '26", value: 85400 },
    { month: "Feb '26", value: 56600 },
    { month: "Mar '26", value: 54500 },
    { month: "Apr '26", value: 71900 },
    { month: "May '26", value: 78100 },
    { month: "Jun '26", value: 33000 },
    { month: "Jul '26", value: 57500 },
    { month: "Aug '26", value: 11500 },
];

const money = (amount: number) =>
    `₹${amount.toLocaleString('en-IN')}`;

const compactMoney = (amount: number) => {
    if (amount === 0) return '₹0';
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2).replace(/0$/, '').replace(/\.$/, '')} L`;
    return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
};

function TDSCompliance() {
    const [reportPeriod, setReportPeriod] = useState('Monthly');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [showCertificateModal, setShowCertificateModal] = useState(false);

    const filteredEntries = useMemo(() => entries.filter((entry) => {
        const query = search.toLowerCase();
        const matchesSearch = [
            entry.section, entry.description, entry.party, entry.branch,
            entry.status, entry.certificate,
        ].some((value) => value.toLowerCase().includes(query));

        return matchesSearch &&
            (typeFilter === 'All' || entry.type === typeFilter) &&
            (statusFilter === 'All' || entry.status === statusFilter);
    }), [search, typeFilter, statusFilter]);

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
    const visibleEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1);
    };

    const handleType = (value: string) => {
        setTypeFilter(value);
        setPage(1);
    };

    const handleStatus = (value: string) => {
        setStatusFilter(value);
        setPage(1);
    };

    const downloadCertificate = (entry: TaxEntry) => {
        const content = [
            'NEXUS ERP — TAX CERTIFICATE',
            `Type: ${entry.type}`,
            `Section: ${entry.section}`,
            `Party: ${entry.party}`,
            `Branch: ${entry.branch}`,
            `Base Amount: ${money(entry.baseAmount)}`,
            `Tax Amount: ${money(entry.taxAmount)}`,
            `Date: ${entry.date}`,
            `Certificate Reference: ${entry.certificate}`,
        ].join('\n');

        const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${entry.type}-certificate-${entry.id}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // const downloadAllCertificates = () => {
    //     const content = entries.map((entry) =>
    //         `${entry.type},${entry.section},${entry.party},${entry.branch},${entry.baseAmount},${entry.taxAmount},${entry.date},${entry.status},${entry.certificate}`
    //     ).join('\n');

    //     const url = URL.createObjectURL(new Blob([`Type,Section,Party,Branch,Base Amount,Tax Amount,Date,Status,Certificate\n${content}`], { type: 'text/csv' }));
    //     const link = document.createElement('a');
    //     link.href = url;
    //     link.download = 'tds-tcs-certificates.csv';
    //     link.click();
    //     URL.revokeObjectURL(url);
    // };

    return (
        <div className="tds-page">
            <div className="tds-page-header">
                <div>
                    <h1>TDS &amp; TCS Compliance</h1>
                    <p>
                        Tax Deducted at Source on vendor/contractor payments, and Tax Collected at Source on high-value vehicle sales — periodic reports and certificate downloads.
                    </p>
                </div>
                <button
                    className="tds-download-button"
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                >
                    ↓ Download Certificate
                </button>
            </div>

            <div className="tds-summary-grid">
                <div className="tds-summary-card"><span>TOTAL TDS DEDUCTED</span><h2>₹5.07 L</h2></div>
                <div className="tds-summary-card"><span>TOTAL TCS COLLECTED</span><h2>₹4.48 L</h2></div>
                <div className="tds-summary-card"><span>CERTIFICATES ISSUED</span><h2>10</h2></div>
                <div className="tds-summary-card"><span>CERTIFICATES PENDING</span><h2>26</h2></div>
            </div>

            <div className="tds-report-period">
                <strong>Report Period:</strong>
                <select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)}>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Half-yearly</option>
                    <option>Yearly</option>
                </select>
                <span>Weekly, monthly, quarterly, half-yearly and yearly views all compute from the same live entries below.</span>
            </div>

            <div className="tds-chart-grid">
                <section className="tds-chart-card">
                    <h3>TDS Deducted — {reportPeriod}</h3>
                    {monthlyTDS.map((item) => (
                        <div className="tds-chart-row" key={item.month}>
                            <div className="tds-chart-label"><span>{item.month}</span><strong>{compactMoney(item.value)}</strong></div>
                            <div className="tds-chart-track"><div className="tds-chart-bar tds-chart-bar-blue" style={{ width: `${item.value === 0 ? 0 : Math.max(4, item.value / 486000 * 100)}%` }} /></div>
                        </div>
                    ))}
                </section>

                <section className="tds-chart-card">
                    <h3>TCS Collected — {reportPeriod}</h3>
                    {monthlyTCS.map((item) => (
                        <div className="tds-chart-row" key={item.month}>
                            <div className="tds-chart-label"><span>{item.month}</span><strong>{compactMoney(item.value)}</strong></div>
                            <div className="tds-chart-track"><div className="tds-chart-bar tds-chart-bar-teal" style={{ width: `${item.value / 85400 * 100}%` }} /></div>
                        </div>
                    ))}
                </section>
            </div>

            <section className="tds-entries-section">
                <div className="tds-entries-heading">
                    <h2>All TDS &amp; TCS Entries</h2>
                    <span>Sections: 194C / 194J / 194I / 194H / 194Q (TDS) · 206C(1F) (TCS on vehicle sale &gt; ₹10 lakh)</span>
                </div>

                <div className="tds-filter-row">
                    <input
                        type="search"
                        placeholder="⌕  Search..."
                        value={search}
                        onChange={(event) => handleSearch(event.target.value)}
                    />
                    <select value={typeFilter} onChange={(event) => handleType(event.target.value)}>
                        <option value="All">Type: All</option>
                        <option value="TDS">Type: TDS</option>
                        <option value="TCS">Type: TCS</option>
                    </select>
                    <select value={statusFilter} onChange={(event) => handleStatus(event.target.value)}>
                        <option value="All">Status: All</option>
                        <option value="Deposited">Deposited</option>
                        <option value="Deducted">Deducted</option>
                        <option value="Collected">Collected</option>
                        <option value="Certificate Issued">Certificate Issued</option>
                    </select>
                    <span className="tds-record-count">{filteredEntries.length} records</span>
                </div>

                <div className="tds-table-wrap">
                    <table className="tds-entries-table">
                        <thead>
                            <tr>
                                <th>TYPE</th><th>SECTION</th><th>PARTY</th><th>BRANCH</th>
                                <th>BASE AMOUNT</th><th>TAX AMOUNT</th><th>DATE</th>
                                <th>STATUS</th><th>CERTIFICATE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleEntries.map((entry) => (
                                <tr key={entry.id}>
                                    <td><span className={`tds-type-pill ${entry.type.toLowerCase()}`}><i />{entry.type}</span></td>
                                    <td><div className="tds-section-code">{entry.section}</div><div className="tds-section-description">{entry.description}</div></td>
                                    <td>{entry.party}</td>
                                    <td>{entry.branch}</td>
                                    <td>{money(entry.baseAmount)}</td>
                                    <td className="tds-tax-amount">{money(entry.taxAmount)}</td>
                                    <td>{entry.date}</td>
                                    <td><span className={`tds-status-pill ${entry.status.toLowerCase().replaceAll(' ', '-')}`}><i />{entry.status}</span></td>
                                    <td>
                                        {entry.status === 'Certificate Issued' ? (
                                            <button className="tds-certificate-button" type="button" onClick={() => downloadCertificate(entry)}>↓ {entry.certificate}</button>
                                        ) : <span className="tds-certificate-pending">{entry.certificate}</span>}
                                    </td>
                                </tr>
                            ))}
                            {visibleEntries.length === 0 && (
                                <tr><td className="tds-empty-row" colSpan={9}>No entries match your search.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="tds-pagination">
                    <span>Page {page} of {totalPages}</span>
                    <div>
                        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Prev</button>
                        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next →</button>
                    </div>
                </div>
            </section>
            {showCertificateModal && (
                <div
                    className="tds-modal-overlay"
                    onClick={() => setShowCertificateModal(false)}
                >
                    <div
                        className="tds-certificate-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="tds-modal-header">
                            <div>
                                <h2>Download Certificate</h2>
                                <p>
                                    Form 16A (TDS) &amp; Form 27D (TCS) —
                                    issued certificates, as fetched from the portal
                                </p>
                            </div>

                            <button
                                type="button"
                                className="tds-modal-close"
                                onClick={() => setShowCertificateModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="tds-modal-table-wrap">
                            <table className="tds-modal-table">
                                <thead>
                                    <tr>
                                        <th>CERTIFICATE</th>
                                        <th>PARTY</th>
                                        <th>AMOUNT</th>
                                        <th></th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {entries
                                        .filter(
                                            (entry) =>
                                                entry.status ===
                                                'Certificate Issued'
                                        )
                                        .map((entry) => (
                                            <tr key={entry.id}>
                                                <td>{entry.certificate}</td>
                                                <td>{entry.party}</td>
                                                <td>
                                                    {money(entry.taxAmount)}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="tds-modal-download"
                                                        onClick={() =>
                                                            downloadCertificate(entry)
                                                        }
                                                    >
                                                        ↓ Download
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="tds-modal-footer">
                            <button
                                type="button"
                                onClick={() => setShowCertificateModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


export default TDSCompliance;


