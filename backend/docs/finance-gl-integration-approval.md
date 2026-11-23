# Nexus ERP — Finance & General Ledger Integration Approval Request & Policy Specification

> **Document Status:** PROPOSED — PENDING FINANCE & ACCOUNTING APPROVAL  
> **Module:** Dealership Finance & Loan Desk $\longleftrightarrow$ General Ledger / Accounting Integration  
> **Target Audience:** Akash (Lead Engineer, Finance & Accounting), Finance Controller, Technical Management, Dealership Operations  
> **Prepared By:** Senior Backend & Financial Systems Engineer  
> **Repository:** `Nova5tech/Nexus_ERP` (`backend/docs/finance-gl-integration-approval.md`)  

---

## 1. Important Company Context & Baseline

Following technical and accounting discussions with Kumar:
1. **Authoritative Accounting System:** The company currently maintains its official Chart of Accounts and statutory financial books in **Tally ERP**.
2. **No Numeric Account Codes:** The company does **not** currently use specific numeric account codes in Tally. Accounts are identified purely by descriptive ledger names organized under standard Tally Groups (e.g., *Current Assets*, *Sundry Debtors*, *Direct Incomes*, *Indirect Incomes*, *Duties & Taxes*).
3. **Missing Artifacts:** No official Tally Chart of Accounts export or sample commission journal voucher has been provided to the engineering team yet.
4. **Illustrative Internal Identifiers Only:** Any numeric account codes referenced in this document or frontend prototypes (specifically `1100`, `1150`, `4300`, and `2100`) are **purely illustrative proposed internal engineering placeholders**. They must **not** be presented or construed as approved company account codes.

> [!WARNING]
> **Illustrative Internal Codes Only:**  
> Codes `1150` (Lender Commission Receivable), `4300` (F&I Commission Revenue), and `2100` (GST Output Liability) are internal placeholders. All official ledger references must be derived directly from the company's Tally Chart of Accounts once exported.

---

## 2. Existing Implemented State vs. Proposed Integration

To establish technical boundaries before making commitments, the current codebase state is contrasted with the proposed integration work:

| Domain | Existing Implemented Functionality | Proposed Functionality (PROPOSED — PENDING APPROVAL) |
| :--- | :--- | :--- |
| **Finance & Loan Desk** | • Complete loan pipeline with 6 lifecycle states (`ENQUIRY`, `SUBMITTED`, `UNDER_REVIEW`, `SANCTIONED`, `DISBURSED`, `REJECTED`).<br>• Branch-level access control and 2% auto-commission calculation.<br>• Isolated single-record update: `PATCH /api/finance/loans/:id/status` advances to `DISBURSED` with **zero accounting triggers**. | • Cross-module atomic orchestration.<br>• Invoking General Ledger within a shared PostgreSQL transaction (`prisma.$transaction`) upon disbursement.<br>• Handling ₹0 commission bypass. |
| **General Ledger Foundation** | • Complete NestJS `GeneralLedgerModule` with `Account`, `JournalEntry`, and `JournalLine` models in PostgreSQL.<br>• Atomic double-entry balancing validation (debit = credit to integer cent precision).<br>• `createJournalEntry()` accepts optional external transaction client (`externalTx`).<br>• 61 unit tests and 15 real PostgreSQL integration tests passing. | • Automatic journal posting triggered by external business modules (Finance & Loan Desk).<br>• Automated account resolution mapped to company Tally ledger names. |
| **Loan Status Transitions** | • `ALLOWED_STATUS_TRANSITIONS` enforces strict FSM progression.<br>• `DISBURSED` is terminal (`[]`). Once reached, the record is locked permanently against changes. | • Proposed cancellation/reversal mechanism.<br>• **Note:** `REVERSED` is **not** currently an enum value in `LoanStatus` in `schema.prisma`. |
| **Authorization & RBAC** | • Authenticated user check via JWT (`JwtAuthGuard`).<br>• Branch authorization (`verifyBranchAccess`) checks caller branch assignment or `SYSTEM_ADMIN` role.<br>• **Any authenticated branch user can currently disburse a loan.** | • Proposed granular permissions: `LOAN_APPROVE` and `LOAN_DISBURSE`.<br>• Role-specific restrictions (e.g. `FINANCE_MANAGER`).<br>• **Note:** Neither `FINANCE_MANAGER` nor `LOAN_DISBURSE` are currently seeded or enforced. |
| **Accounting Source of Truth** | • Independent PostgreSQL database schema with `Account`, `JournalEntry`, and `JournalLine` tables. | • Architectural decision required: Autonomous Nexus GL vs. Tally synchronization / export bridge. |

---

## 3. Core Architectural Decisions Requiring Alignment

### Decision A: System of Record — Tally ERP vs. Nexus ERP General Ledger

Because company accounts are maintained in Tally ERP, engineering requires a formal architectural decision on the relationship between Nexus ERP and Tally:

- **Option 1 (Tally Authoritative — Export / Bridge Model):**  
  Tally remains the sole official General Ledger. Nexus ERP acts as an operational sub-ledger for dealership finance, tracking loans and generating daily/monthly journal vouchers exported as Tally XML or structured Excel for accountant review and import into Tally.
- **Option 2 (Nexus ERP Autonomous General Ledger):**  
  Nexus ERP maintains its own independent, real-time double-entry General Ledger using its PostgreSQL database. Tally is either synchronized periodically or phased out as Nexus ERP expands.
- **Option 3 (Hybrid Dual-Bookkeeping — Recommended):**  
  Nexus ERP writes real-time PostgreSQL journal entries for dealership reporting and auditability, and provides an export bridge (or synchronization queue) to push corresponding vouchers into Tally.

---

## 4. Proposed Accounting Policies (PROPOSED — PENDING FINANCE APPROVAL)

All proposals in this section are **strictly provisional recommendations** awaiting sign-off from Akash and the Finance Controller.

### 4.1 Commission Receivable Account (Debit on Disbursement)
- **Status:** PROPOSED — PENDING FINANCE APPROVAL
- **Proposed Approach:** Debit a dedicated control account for lender receivables (illustrative proposed internal code: `1150 — Lender Commission Receivable`), categorized under Current Assets.
- **Rationale:** Keeps institutional bank/NBFC receivables distinct from customer retail vehicle trade receivables (often labeled `1100 — Accounts Receivable`).
- **Tally Alignment Required:** Finance must confirm the exact Tally Ledger Name (e.g., `"Sundry Debtors - Financiers"` or distinct sub-ledgers per lender).

### 4.2 Commission Revenue Account (Credit on Disbursement)
- **Status:** PROPOSED — PENDING FINANCE APPROVAL
- **Proposed Approach:** Credit a dedicated F&I commission income account (illustrative proposed internal code: `4300 — F&I Commission Revenue`), categorized under Indirect Incomes / Operating Revenue.
- **Rationale:** Aligns with standard revenue recognition principles by recognizing earned commission income upon lender disbursement confirmation.
- **Tally Alignment Required:** Finance must confirm the exact Tally Ledger Name under Incomes (e.g., `"Finance Commission Income"`, `"Bank Payout Income"`).

### 4.3 GST & Indirect Tax Treatment
- **Status:** PROPOSED — PENDING FINANCE APPROVAL
- **Tax Policy Warning:** There is currently **no approved company tax policy** regarding commission payouts from lenders. Engineering makes **no definitive claims** regarding GST rates, SAC codes, or tax applicability.
- **Questions for Finance Controller:**
  1. Is dealership commission treated as **exclusive** of GST (dealer bills GST on top of commission) or **inclusive** of GST (GST is back-calculated from the payout)?
  2. What is the approved GST rate and SAC classification under the company's tax registration?
  3. **Timing of Tax Recognition:** Should GST output liability (illustrative internal placeholder: `2100`) be booked immediately upon individual loan disbursement, or should GST recognition occur only when the monthly consolidated B2B Tax Invoice is issued to the lending institution?
- **Provisional Proposal:** Record pure commission accrual at loan disbursement without tax lines, and book GST output liability only upon generating the official monthly tax invoice to the lender. *(Pending Finance Controller confirmation).*

### 4.4 Handling of Zero-Commission Loans
- **Status:** PROPOSED — PENDING FINANCE APPROVAL
- **Operational Context:** Dealerships frequently finance vehicles through subvented retail schemes, OEM promotional tie-ups, or direct customer financing where the dealership earns ₹0.00 commission.
- **Proposed Approach:** Allow zero-commission loans to advance to `DISBURSED`, but **bypass General Ledger journal creation**.
- **Technical Invariant:** PostgreSQL and `GeneralLedgerService` strictly reject journal entries where all lines are ₹0.00 (`BadRequestException: Each journal line must contain either debit or credit > 0`). Bypassing GL posting when `commissionAmount === 0.00` ensures sales deliveries are not blocked while preserving ledger invariants.

### 4.5 Disbursement Authorization & Segregation of Duties (SoD)
- **Status:** PROPOSED — PENDING FINANCE APPROVAL
- **Existing Implementation:** Currently, `FinanceLoanService.verifyBranchAccess()` only verifies branch assignment or `SYSTEM_ADMIN` role. **Any authenticated user assigned to a branch can currently disburse a loan.**
- **Missing Authorization Rules:**
  - The role `FINANCE_MANAGER` is neither seeded nor recognized in authorization logic.
  - The granular permissions `LOAN_APPROVE` and `LOAN_DISBURSE` do not exist in the database or in any controller guard/decorator.
- **Proposed Approach:** Implement dual-control segregation of duties:
  - `BRANCH_MANAGER` holds `LOAN_APPROVE` to sanction loans (`UNDER_REVIEW` $\rightarrow$ `SANCTIONED`).
  - Only `FINANCE_MANAGER` or `SYSTEM_ADMIN` holding `LOAN_DISBURSE` can trigger disbursement and financial ledger posting.
- **Implementation Scope:** Requires seeding new permissions in `seed-admin.ts`, creating NestJS authorization guards, and updating RBAC policies.

### 4.6 Reversal & Cancellation Policy
- **Status:** PROPOSED — PENDING FINANCE APPROVAL
- **Existing Implementation:** In `FinanceLoanService`, `ALLOWED_STATUS_TRANSITIONS['DISBURSED'] = []`. Disbursed loans are completely locked.
- **Schema Limitation:** `REVERSED` is **not** currently an enum value in `LoanStatus` in [`backend/prisma/schema.prisma`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/prisma/schema.prisma).
- **Proposed Approach:**
  - Create a dedicated reversal endpoint: `POST /api/finance/loans/:id/reverse`.
  - Require `SYSTEM_ADMIN` or `FINANCE_MANAGER` authorization.
  - Automatically generate an offsetting, reversing journal entry in the General Ledger (Debit: Commission Revenue, Credit: Commission Receivable) with an audit reference linking back to the original disbursement entry.
- **Implementation Scope Required:**
  1. Prisma schema modification to add `REVERSED` to `LoanStatus` enum.
  2. Creation and deployment of a new Prisma database migration.
  3. Updating `ALLOWED_STATUS_TRANSITIONS` in `FinanceLoanService`.
  4. Updating service methods, DTOs, and controllers.
  5. Updating unit tests (`finance-loan.service.spec.ts`) and PostgreSQL integration tests.

---

## 5. Artifact Requests from Finance Team

Before coding the integration, the engineering team formally requests the following artifacts from the finance team:

1. **Official Tally Chart of Accounts Export:**
   - An XML, Excel, or PDF export of the current active Tally Ledgers and parent Groups (specifically under *Current Assets*, *Sundry Debtors*, *Direct/Indirect Incomes*, and *Duties & Taxes*).
2. **Sample Commission Journal Voucher:**
   - At least one anonymized historical journal voucher from Tally showing how the finance team currently records a vehicle loan commission payout from a bank/NBFC (including exact debit ledger name, credit ledger name, tax deductions like TDS/GST, and narration format).
3. **Lender Mapping Table:**
   - Confirmation on whether lenders (e.g. *Vertex Capital, Suraksha NBFC, BlueLeaf Finance, Nationwide Bank*) map to individual subsidiary ledgers in Tally or a unified control ledger.

---

## 6. Stakeholder Decision & Sign-Off Matrix

Please complete the **"Final Approved Decision"** column to authorize implementation:

| # | Requirement | Proposed Approach (Engineering Recommendation) | Current Implementation Status | Approval Required From | Final Approved Decision *(Completed by Stakeholder)* |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Accounting Source of Record** | Hybrid: Operational GL in Nexus ERP; periodic journal export to Tally ERP. | Nexus GL models exist; no Tally export/sync bridge implemented. | Chief Financial Officer / IT Lead | *(Blank for Stakeholder)* |
| **2** | **Commission Receivable Account** | Debit dedicated Current Asset control ledger (illustrative proposed internal code: `1150`). | Account model exists; specific company Tally ledger name unconfirmed. | Finance Controller / Akash | *(Blank for Stakeholder)* |
| **3** | **Commission Revenue Account** | Credit dedicated F&I Commission Income ledger (illustrative proposed internal code: `4300`). | Account model exists; specific company Tally ledger name unconfirmed. | Finance Controller / Akash | *(Blank for Stakeholder)* |
| **4** | **GST Treatment & Timing** | Net accrual at disbursement; defer GST output liability booking until tax invoice generation. | No tax calculation or GST posting logic exists in Finance-Loan module. | Tax Compliance Officer / Finance Controller | *(Blank for Stakeholder)* |
| **5** | **Applicable GST Rate & SAC** | GST rate and SAC to be specified by Tax Lead; no statutory assumptions made by engineering. | No GST rules or rates configured in backend. | Tax Compliance Officer | *(Blank for Stakeholder)* |
| **6** | **Zero-Commission Loans** | Allow transition to `DISBURSED`; bypass GL journal entry when `commissionAmount === 0`. | Currently allows `DISBURSED` with zero GL calls. | Dealership Operations Lead / Finance Lead | *(Blank for Stakeholder)* |
| **7** | **Disbursement Authorization** | Restrict disbursement to `FINANCE_MANAGER` and `SYSTEM_ADMIN` via `LOAN_DISBURSE` permission. | Not implemented. Any authenticated branch user can currently disburse. | Operations Lead / Security Lead | *(Blank for Stakeholder)* |
| **8** | **Loan Reversal & Cancellation** | Add `REVERSED` status and post offsetting journal entry via dedicated endpoint. | Not implemented. `DISBURSED` is strictly terminal. `REVERSED` not in Prisma enum. | Finance Controller / Technical Lead | *(Blank for Stakeholder)* |

---

## 7. Sign-Off Confirmation Block

**Reviewed and Approved By:**

Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Designation: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Department: Finance & Accounting / Dealership Operations  
Signature / Authorization: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  

**Special Accounting Instructions or Branch Overrides:**  
*(Please note any branch-specific ledger names, Tally integration preferences, or GST rounding instructions here)*
