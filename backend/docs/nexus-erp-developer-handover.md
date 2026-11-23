# Nexus ERP — Developer Knowledge Transfer & Backend Handover Document

> **Document Classification:** Engineering Handover & Developer Onboarding Specification  
> **Prepared For:** Sravya (Incoming Software Developer / Backend Developer)  
> **Prepared By:** Senior Backend Architect, Technical Documentation Engineer & Handover Specialist  
> **Company / Project:** Nova5 Technologies — Nexus ERP  
> **Working Branch:** `feature/finance-loan-backend-v2`  
> **Target System:** Dealership Finance & Loan Desk + General Ledger Foundations  
> **Date:** November 2026  

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [Finance & Loan Desk Backend](#4-finance--loan-desk-backend)
5. [General Ledger Backend Foundation](#5-general-ledger-backend-foundation)
6. [Database Architecture & Migrations](#6-database-architecture--migrations)
7. [Authentication, Authorization & RBAC](#7-authentication-authorization--rbac)
8. [Development Environment Setup](#8-development-environment-setup)
9. [Testing & Verification Architecture](#9-testing--verification-architecture)
10. [Completed Work Breakdown](#10-completed-work-breakdown)
11. [Pending Work & Known Gaps](#11-pending-work--known-gaps)
12. [Finance-to-General Ledger Integration Design (Proposed)](#12-finance-to-general-ledger-integration-design-proposed)
13. [Existing Documentation Index](#13-existing-documentation-index)
14. [Handover Checklist for Sravya](#14-handover-checklist-for-sravya)
15. [Recommended Next Tasks (Prioritized)](#15-recommended-next-tasks-prioritized)
16. [Glossary & Technical Definitions](#16-glossary--technical-definitions)

---

## 1. Project Overview

### 1.1 What Nexus ERP Is
Nexus ERP is an enterprise-grade Dealership Management System (DMS) and Enterprise Resource Planning platform developed by Nova5 Technologies. It is engineered specifically for multi-branch automobile dealerships to manage vehicle sales, spare parts inventory, service workshop operations, dealership financing/loans, and financial accounting within a unified multi-tenant platform.

### 1.2 Architectural Paradigm: Modular Monolith
Nexus ERP is built as a **NestJS Modular Monolith**. While individual business capabilities are encapsulated into clean, decoupled domain modules (`AuthModule`, `HealthModule`, `FinanceLoanModule`, `GeneralLedgerModule`), they execute within a single NestJS runtime and communicate over in-memory service calls sharing a common PostgreSQL database. This delivers high developer productivity, straightforward local setup, and ACID transactional guarantees across modules without the operational overhead of microservices.

```mermaid
graph TD
    Client[Web Browser / React Frontend :5173] -->|HTTP / JSON + Bearer JWT| Gateway[NestJS Global Prefix: /api]
    Gateway --> AuthM[AuthModule :3000]
    Gateway --> HealthM[HealthModule :3000]
    Gateway --> FinanceM[FinanceLoanModule :3000]
    Gateway --> GLM[GeneralLedgerModule :3000]
    
    AuthM --> Prisma[PrismaService / pg Pool Adapter]
    HealthM --> Prisma
    FinanceM --> Prisma
    GLM --> Prisma
    
    Prisma --> PG[(PostgreSQL 16 'nexus_erp' :5433)]
```

### 1.3 Business Modules
1. **Platform Access & Auth (`backend/src/modules/auth`):** Identity management, bcrypt password hashing, JWT issuance and passport strategy validation, multi-branch user memberships (`UserBranch`), and role-based permissions (`Role`, `Permission`, `RolePermission`).
2. **System Health (`backend/src/modules/health`):** Liveness probes (`/api/health`) and database connection readiness checks (`/api/health/ready`).
3. **Finance & Loan Desk (`backend/src/modules/finance-loan`):** Automotive retail financing workflow. Manages customer applications, financier tie-ups, loan pipeline state progression, auto-calculated dealership commission (2% standard), branch-scoped multi-tenancy, and dealership executive metrics.
4. **General Ledger Foundation (`backend/src/modules/general-ledger`):** Enterprise double-entry accounting engine. Manages Chart of Accounts, journal entry creation with integer-cent debit/credit validation, posting dates, immutable voiding audit trails, multi-tenant branch isolation, and idempotency protection on composite source keys `(sourceModule, sourceReference)`.

### 1.4 My Responsibilities & Implemented Scope
As the outgoing Backend Developer, my primary focus was designing, hardening, and verifying:
- The entire **Finance & Loan Desk Backend API** (`FinanceLoanService`, `FinanceLoanController`, validation DTOs, branch security).
- The complete **General Ledger Backend Foundation** (`GeneralLedgerService`, `GeneralLedgerController`, validation DTOs, Prisma models, database migration `20261022144500_add_general_ledger_foundation`).
- Comprehensive regression and unit test suites (**61 passing tests** across 10 suites).
- Real PostgreSQL integration verification (**15 passing integration tests** on port 5433).
- Comprehensive architectural integration blueprints and stakeholder approval requests.

### 1.5 Current Project Status
- **Backend Build:** Clean (`nest build` exit code `0`).
- **Linter:** Clean (`eslint` 0 errors, 0 warnings).
- **Unit Tests:** 61/61 passing.
- **Database Migrations:** All 3 migrations deployed and up to date on PostgreSQL.
- **Finance-to-GL Integration Status:** **Decoupled (Not Wired Yet).** Advancing a loan to `DISBURSED` currently updates `LoanApplication.status` in isolation. The integration blueprint is fully documented in `backend/docs/finance-gl-integration-readiness.md` and `backend/docs/finance-gl-integration-approval.md`, pending official Tally ERP Chart of Accounts confirmation from the finance team.

---

## 2. Technology Stack

| Technology | Version / Configuration | Purpose in Nexus ERP |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.x` (verified on v22/v24) | Server-side JavaScript runtime environment. |
| **NestJS** | `^11.0.1` | Progressive TypeScript framework providing dependency injection, modular encapsulation, validation pipes, and route controllers. |
| **TypeScript** | `^5.7.3` (backend), `~6.0.2` (frontend) | Strongly typed application logic, DTO contracts, and compile-time error detection. |
| **PostgreSQL** | `16-alpine` (Docker container: `nexus-postgres`) | Relational database enforcing ACID transactions, foreign keys, unique constraints, and `DECIMAL(14,2)` precision. |
| **Prisma ORM** | `7.10.1` (`@prisma/client`, `@prisma/adapter-pg`) | Type-safe query builder, declarative schema management, and automated SQL migrations. Uses driver adapter architecture with `pg.Pool`. |
| **Passport & JWT** | `passport-jwt ^4.0.1`, `@nestjs/jwt ^12.0.3` | Stateless Bearer token authentication transmitting authenticated user claims (`userId`, `roles`, `permissions`, `branchIds`). |
| **Class Validator / Transformer** | `class-validator ^0.15.1`, `class-transformer ^0.5.1` | Global validation pipe enforcing runtime validation, type coercion, string trimming, and bounds checking on incoming request payloads. |
| **Node Test Runner & ts-node** | `node:test`, `ts-node ^10.9.2` | Fast, dependency-free test runner executing unit and integration specs directly from TypeScript source without compilation delays. |
| **React & Vite** | `react ^19.2.8`, `vite ^8.3.0`, Tailwind CSS `^4.3.3` | Single-page dealership dashboard frontend running on port 5173. |
| **Docker Desktop** | Engine v29.x, WSL 2 backend | Containerization host running `nexus-postgres` isolated on host port 5433 (preventing conflict with native PostgreSQL on 5432). |

---

## 3. Repository Structure

```text
ERP/
├── backend/                               # NestJS Modular Monolith Application
│   ├── docs/                              # Project Architecture & Audit Documents
│   │   ├── finance-loan-api.md            # Complete REST API specification for Loan Desk
│   │   ├── general-ledger-design.md       # Technical design of General Ledger foundation
│   │   ├── finance-loan-ledger-integration-plan.md # Architectural plan for loan disbursement GL posting
│   │   ├── finance-gl-integration-readiness.md     # Audit of readiness, gaps, and prerequisites
│   │   ├── finance-gl-integration-approval.md      # Revised stakeholder decision matrix & Tally alignment
│   │   └── nexus-erp-developer-handover.md         # THIS HANDOVER DOCUMENT
│   ├── prisma/                            # Prisma Schema & Database Migrations
│   │   ├── migrations/
│   │   │   ├── 20261016110302_platform_access_foundation/ # Auth, User, Branch, Role, Permission tables
│   │   │   ├── 20261019110838_add_loan_applications/      # LoanStatus enum, LoanApplication table
│   │   │   └── 20261022144500_add_general_ledger_foundation/ # Account, JournalEntry, JournalLine tables
│   │   ├── schema.prisma                  # Authoritative database model definitions
│   │   └── seed-admin.ts                  # Bootstrap admin creation script
│   ├── src/
│   │   ├── generated/prisma/              # Prisma client generated output artifacts
│   │   ├── modules/
│   │   │   ├── auth/                      # Authentication & JWT verification
│   │   │   │   ├── dto/login.dto.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts        # Extracts AuthenticatedUser claims from JWT
│   │   │   │   ├── jwt-auth.guard.ts      # Global endpoint protection guard
│   │   │   │   └── auth.service.spec.ts   # 8 unit tests
│   │   │   ├── health/                    # System health probes (/api/health, /api/health/ready)
│   │   │   ├── finance-loan/              # Dealership Finance & Loan Desk Module
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-loan.dto.ts
│   │   │   │   │   ├── update-loan-status.dto.ts
│   │   │   │   │   └── loan-query.dto.ts
│   │   │   │   ├── finance-loan.controller.ts # 5 REST endpoints
│   │   │   │   ├── finance-loan.service.ts    # Business logic, FSM transitions, branch security
│   │   │   │   ├── finance-loan.controller.spec.ts # 5 controller unit tests
│   │   │   │   └── finance-loan.service.spec.ts    # 15 service unit tests
│   │   │   └── general-ledger/            # Double-Entry General Ledger Foundation
│   │   │       ├── dto/
│   │   │       │   ├── create-account.dto.ts
│   │   │       │   ├── account-query.dto.ts
│   │   │       │   ├── create-journal-entry.dto.ts
│   │   │       │   ├── journal-entry-line.dto.ts
│   │   │       │   ├── journal-query.dto.ts
│   │   │       │   └── void-journal-entry.dto.ts
│   │   │       ├── general-ledger.controller.ts # 8 REST endpoints
│   │   │       ├── general-ledger.service.ts    # Balancing logic, cent precision, posting, voiding
│   │   │       ├── general-ledger.controller.spec.ts # 8 controller unit tests
│   │   │       ├── general-ledger.service.spec.ts    # 25 service unit tests
│   │   │       └── general-ledger.integration.spec.ts# 15 real PostgreSQL integration tests
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts           # Global database module
│   │   │   └── prisma.service.ts          # PrismaClient subclass with pg.Pool driver adapter
│   │   ├── app.module.ts                  # Root application module wiring
│   │   └── main.ts                        # Application bootstrap, CORS, global validation pipe
│   ├── package.json                       # Backend dependencies and npm scripts
│   ├── tsconfig.json                      # Backend TypeScript compiler configuration
│   └── prisma.config.ts                   # Prisma 7 CLI configuration
├── frontend/                              # Dealership Dashboard UI (React + Vite)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── finance-loan/              # Loan Desk UI prototype (FinanceLoan.tsx)
│   │   │   └── finance-accounting/        # Accounting UI prototype (FinanceAccounting.tsx)
│   │   ├── App.tsx                        # Main UI container
│   │   └── main.tsx                       # React DOM entry point
│   ├── package.json                       # Frontend dependencies and npm scripts
│   └── vite.config.ts                     # Vite build and dev server configuration
└── .gitignore                             # Git ignore rules
```

---

## 4. Finance & Loan Desk Backend

### 4.1 Module Architecture
Located in [`backend/src/modules/finance-loan/`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/src/modules/finance-loan/).  
The module encapsulates loan origination, pipeline state management, branch scoping, and executive metrics calculations.

### 4.2 LoanApplication Database Model
Defined in [`backend/prisma/schema.prisma`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/prisma/schema.prisma#L97-L117):
```prisma
enum LoanStatus {
  ENQUIRY
  SUBMITTED
  UNDER_REVIEW
  SANCTIONED
  DISBURSED
  REJECTED
}

model LoanApplication {
  id               String      @id @default(cuid())
  customerName     String
  lenderName       String
  loanAmount       Decimal     @db.Decimal(14, 2)
  interestRate     Decimal     @db.Decimal(5, 2)
  tenureMonths     Int
  commissionAmount Decimal     @default(0.00) @db.Decimal(12, 2)
  status           LoanStatus  @default(ENQUIRY)
  branchId         String
  branch           Branch      @relation(fields: [branchId], references: [id], onDelete: Restrict)
  submittingUserId String
  submittingUser   User        @relation(fields: [submittingUserId], references: [id], onDelete: Restrict)
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@index([branchId])
  @@index([status])
  @@index([createdAt])
  @@index([branchId, status])
}
```

### 4.3 Loan Lifecycle & Allowed Status Transitions
The status transitions are enforced strictly by a Finite State Machine in [`finance-loan.service.ts`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/src/modules/finance-loan/finance-loan.service.ts#L18-L25):

```typescript
export const ALLOWED_STATUS_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  [LoanStatus.ENQUIRY]: [LoanStatus.SUBMITTED, LoanStatus.REJECTED],
  [LoanStatus.SUBMITTED]: [LoanStatus.UNDER_REVIEW, LoanStatus.REJECTED],
  [LoanStatus.UNDER_REVIEW]: [LoanStatus.SANCTIONED, LoanStatus.REJECTED],
  [LoanStatus.SANCTIONED]: [LoanStatus.DISBURSED, LoanStatus.REJECTED],
  [LoanStatus.DISBURSED]: [], // Terminal state - permanently locked
  [LoanStatus.REJECTED]: [LoanStatus.ENQUIRY, LoanStatus.SUBMITTED], // Allow re-opening
};
```

```mermaid
stateDiagram-v2
    [*] --> ENQUIRY: Create Application
    ENQUIRY --> SUBMITTED: Submit to Lender
    ENQUIRY --> REJECTED: Reject
    SUBMITTED --> UNDER_REVIEW: Underwriter Review
    SUBMITTED --> REJECTED: Reject
    UNDER_REVIEW --> SANCTIONED: Loan Sanctioned
    UNDER_REVIEW --> REJECTED: Reject
    SANCTIONED --> DISBURSED: Lender Disbursed (Terminal Lock)
    SANCTIONED --> REJECTED: Cancel / Reject
    REJECTED --> ENQUIRY: Re-open Enquiry
    REJECTED --> SUBMITTED: Re-submit Application
    DISBURSED --> [*]
```

**Key Lifecycle Properties:**
- Transition to `DISBURSED` is allowed **strictly from `SANCTIONED`**. Transitioning directly from `ENQUIRY`, `SUBMITTED`, or `UNDER_REVIEW` throws `BadRequestException(400)`.
- `DISBURSED` is **terminal**. Once disbursed, no further status updates are permitted (`"This application is in a terminal state and cannot be changed."`).
- **Reversals:** There is currently no `REVERSED` enum value or reversal transition implemented.

### 4.4 Commission Calculation Logic
When creating a loan via `POST /api/finance/loans`:
- If `commissionAmount` is omitted in `CreateLoanDto`, `FinanceLoanService` automatically calculates:
  $$\text{commissionAmount} = \text{round}\big(\text{loanAmount} \times 0.02, 2\big)$$
- If explicitly provided, it is rounded to 2 decimal places: `Math.round(rawCommission * 100) / 100`.

### 4.5 Branch Access Control & Multi-Tenancy
Multi-tenancy is enforced at the branch level:
1. `isAdmin(user)` checks if the user possesses the `SYSTEM_ADMIN` role or permission.
2. System Administrators can query and create loans across any dealership branch.
3. Non-admin users are strictly validated against `user.branchIds`. If a non-admin attempts to create, view, or update a loan outside their assigned branches, the service immediately throws `ForbiddenException(403)`.
4. When listing loans (`findAll`), non-admin queries automatically apply `where.branchId = { in: user.branchIds }`.

### 4.6 REST Endpoints Specification

#### 1. `POST /api/finance/loans` — Create Application
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body (`CreateLoanDto`):**
  ```json
  {
    "customerName": "Ayesha Rao",
    "lenderName": "Vertex Capital",
    "loanAmount": 600000,
    "interestRate": 9.5,
    "tenureMonths": 36,
    "commissionAmount": 12000,
    "branchId": "branch_cuid_123"
  }
  ```
- **Response (201 Created):** Full `LoanApplication` entity including joined `branch` and `submittingUser`.

#### 2. `GET /api/finance/loans` — List Applications
- **Query Parameters (`LoanQueryDto`):** `status`, `branchId`, `lender`, `search` (searches customer name), `page` (default: 1), `limit` (default: 20).
- **Response (200 OK):**
  ```json
  {
    "data": [ /* Array of LoanApplication records */ ],
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
  ```

#### 3. `GET /api/finance/loans/metrics` — Aggregate Dashboard Metrics
- **Query Parameters:** `branchId?` (optional; scoped to caller branches).
- **Response (200 OK):**
  ```json
  {
    "totalApplications": 45,
    "activeLoans": 18,
    "disbursedCount": 22,
    "totalDisbursedAmount": 14500000.00,
    "totalCommissionEarned": 290000.00,
    "byStatus": {
      "ENQUIRY": 5,
      "SUBMITTED": 4,
      "UNDER_REVIEW": 9,
      "SANCTIONED": 3,
      "DISBURSED": 22,
      "REJECTED": 2
    }
  }
  ```

#### 4. `GET /api/finance/loans/:id` — Retrieve Single Application
- **Response (200 OK):** Loan entity if authorized, or `404 Not Found` / `403 Forbidden`.

#### 5. `PATCH /api/finance/loans/:id/status` — Update Loan Status
- **Request Body (`UpdateLoanStatusDto`):**
  ```json
  {
    "status": "DISBURSED"
  }
  ```
- **Response (200 OK):** Updated loan record.

---

## 5. General Ledger Backend Foundation

### 5.1 Module Architecture
Located in [`backend/src/modules/general-ledger/`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/src/modules/general-ledger/).  
The General Ledger provides financial double-entry bookkeeping, strict mathematical balancing, journal lifecycle management, and audit tracking.

### 5.2 Database Models & Relationships
Defined in [`backend/prisma/schema.prisma`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/prisma/schema.prisma#L119-L186):

```mermaid
erDiagram
    Branch ||--o{ Account : "hosts (optional)"
    Branch ||--o{ JournalEntry : "records"
    User ||--o{ JournalEntry : "creates"
    Account ||--o{ JournalLine : "categorizes"
    JournalEntry ||--|{ JournalLine : "contains (CASCADE)"

    Account {
        string id PK
        string code UK
        string name
        AccountType type
        boolean isActive
        string branchId FK
    }

    JournalEntry {
        string id PK
        string entryNumber UK
        datetime entryDate
        datetime postingDate
        JournalStatus status
        string sourceModule
        string sourceReference
        string narration
        string branchId FK
        string createdById FK
    }

    JournalLine {
        string id PK
        string journalEntryId FK
        string accountId FK
        string description
        decimal debitAmount
        decimal creditAmount
    }
```

### 5.3 Double-Entry Invariants & Integer-Cent Balancing
To eliminate IEEE-754 floating-point rounding errors in financial transactions, [`GeneralLedgerService`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/src/modules/general-ledger/general-ledger.service.ts#L222-L274) enforces:
1. **Minimum Lines:** A journal entry must contain at least 2 lines.
2. **Fractional Cent Validation:** Line amounts cannot have more than 2 decimal places (`Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-4`).
3. **Exclusivity:** Each line must contain either a debit or a credit amount, strictly not both and not neither.
4. **Exact Mathematical Equality:**
   $$\sum \text{debitCents} == \sum \text{creditCents}$$
   Any delta throws `BadRequestException(400): "Journal entry is not balanced. Total debits (X) must equal total credits (Y). Difference: Z"`.

### 5.4 Journal Entry Lifecycle: Draft, Posted, Void
```mermaid
stateDiagram-v2
    [*] --> DRAFT: createJournalEntry(status='DRAFT')
    [*] --> POSTED: createJournalEntry(status='POSTED' or default)
    DRAFT --> POSTED: postDraftEntry() -> sets postingDate
    POSTED --> VOID: voidJournalEntry(reason) -> appends audit narration
    VOID --> [*]: Permanent audit lock
```

- **Direct Creation as VOID:** Strictly rejected with `BadRequestException`.
- **DRAFT:** Created with `postingDate = null`. Can later be transitioned to `POSTED` via `POST /api/ledger/journal-entries/:id/post`.
- **POSTED:** Timestamped with `postingDate = new Date()`.
- **VOID:** Executed via `POST /api/ledger/journal-entries/:id/void`. Financial history is **never deleted**. The status transitions to `VOID`, audit reason is appended to `narration` (`[VOIDED: <reason>]`), and all underlying `JournalLine` rows remain preserved in PostgreSQL.
- **Double Void / Voiding Draft:** Attempting to void an already voided entry or voiding a draft throws `BadRequestException`.

### 5.5 Source Idempotency & Concurrency Safeguards
In [`schema.prisma`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/prisma/schema.prisma#L171), the model enforces:
```prisma
@@unique([sourceModule, sourceReference])
```
When external modules post journal entries (e.g. `sourceModule: "FINANCE_LOAN"`, `sourceReference: "loan_id_123"`):
1. **Pre-Check:** Pre-transaction lookup catches duplicate attempts and returns `ConflictException(409)`.
2. **Concurrent Collision Handling:** If two concurrent requests pass pre-check simultaneously, PostgreSQL enforces the unique index, throwing Prisma error `P2002`. `GeneralLedgerService` catches `P2002` on `sourceModule_sourceReference` and safely converts it to `ConflictException(409)`. Duplicate entries are physically impossible in PostgreSQL.

### 5.6 External Transaction Support (`externalTx`)
`GeneralLedgerService.createJournalEntry()` has a signature designed specifically for atomic multi-module transactions:
```typescript
async createJournalEntry(
  user: AuthenticatedUser,
  dto: CreateJournalEntryDto,
  externalTx?: Prisma.TransactionClient,
)
```
If `externalTx` is supplied, it executes all database operations within the caller's transaction. If omitted, it automatically creates a new transaction (`this.prisma.$transaction(...)`).

### 5.7 REST Endpoints Specification
- `POST /api/ledger/accounts` — Create Account (`CreateAccountDto`).
- `GET /api/ledger/accounts` — List Accounts (`AccountQueryDto`).
- `GET /api/ledger/accounts/:id` — Retrieve Account by ID.
- `POST /api/ledger/journal-entries` — Record Journal Entry (`CreateJournalEntryDto`).
- `GET /api/ledger/journal-entries` — List Journal Entries with line items (`JournalQueryDto`).
- `GET /api/ledger/journal-entries/:id` — Retrieve Single Journal Entry with line items.
- `POST /api/ledger/journal-entries/:id/post` — Post a Draft Journal Entry.
- `POST /api/ledger/journal-entries/:id/void` — Void a Posted Journal Entry (`VoidJournalEntryDto`).

---

## 6. Database Architecture & Migrations

### 6.1 PostgreSQL Target Configuration
- **Host / Port:** `localhost:5433` (Docker container: `nexus-postgres`).
- **Database:** `nexus_erp` (Schema: `public`).
- **Isolation Note:** Host machine runs a native PostgreSQL 18 Windows service on port `5432`. Nexus ERP uses port `5433` to prevent port collisions.
- **Connection URL Format (`backend/.env`):**
  ```ini
  DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5433/nexus_erp?schema=public
  ```

### 6.2 Existing Migrations
Located in [`backend/prisma/migrations/`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/prisma/migrations/):

1. **`20261016110302_platform_access_foundation`:**
   - Creates `User`, `Branch`, `Role`, `Permission`, and join tables `UserRole`, `RolePermission`, `UserBranch`.
2. **`20261019110838_add_loan_applications`:**
   - Creates enum `LoanStatus` (`ENQUIRY`, `SUBMITTED`, `UNDER_REVIEW`, `SANCTIONED`, `DISBURSED`, `REJECTED`).
   - Creates table `LoanApplication` with foreign keys to `Branch` and `User`.
3. **`20261022144500_add_general_ledger_foundation`:**
   - Creates enums `AccountType` (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`) and `JournalStatus` (`DRAFT`, `POSTED`, `VOID`).
   - Creates tables `Account`, `JournalEntry`, and `JournalLine`.
   - Adds unique constraint `JournalEntry_sourceModule_sourceReference_key`.

### 6.3 Safe Database Migration Workflow
When modifying `schema.prisma`:
```bash
# 1. Validate schema syntax without applying changes
npx prisma validate

# 2. Check applied migration status on PostgreSQL
npx prisma migrate status

# 3. In development: apply migrations or generate a new migration
npx prisma migrate dev --name <migration_name>

# 4. In CI/Production: deploy verified migration SQL without schema alterations
npx prisma migrate deploy

# 5. Regenerate Prisma Client
npm run prisma:generate
```

> [!CAUTION]
> **Strict Database Safety Rules:**  
> Never run `prisma migrate reset`, `prisma db push --force-reset`, or drop tables in any shared or testing database. Always inspect generated SQL files under `backend/prisma/migrations/` before deploying.

---

## 7. Authentication, Authorization & RBAC

### 7.1 JWT Authentication Flow
1. User logs in via `POST /api/auth/login` (`email`, `password`).
2. `AuthService.login()` validates credentials via `bcrypt.compare` against `User.passwordHash`.
3. Issues a signed JWT containing payload claims: `sub` (`userId`), `email`, `department`, `roles`, `permissions`, `branchIds`.
4. Client passes token in subsequent requests: `Authorization: Bearer <jwt>`.
5. `JwtStrategy` validates the token and injects `req.user` conforming to `AuthenticatedUser`.

### 7.2 Existing Roles vs. Missing Permissions
- **Currently Implemented:**
  - Role: `SYSTEM_ADMIN` (grants global access across all branches and bypasses branch restrictions).
  - Multi-Branch Assignment: `UserBranch` links users to authorized dealership branches.
- **Missing / Proposed Authorization Rules (NOT Yet Implemented):**
  - Role `FINANCE_MANAGER` is **not** currently defined or seeded in `backend/prisma/seed-admin.ts`.
  - Permissions `LOAN_APPROVE` and `LOAN_DISBURSE` do **not** exist in the database or in any controller guards.
  - **Current Behavior:** Any authenticated user assigned to a dealership branch can currently call `PATCH /api/finance/loans/:id/status` to advance a loan to `DISBURSED`. Introducing segregation of duties requires defining these permissions, assigning them to roles, and creating NestJS guards.

---

## 8. Development Environment Setup

Follow these verified steps to run the complete Nexus ERP system locally.

### 8.1 Prerequisites
- **Node.js:** v20.x or higher (`node -v`)
- **Docker Desktop:** Running with WSL 2 integration (`docker -v`)

### 8.2 Environment Configuration
Create [`backend/.env`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/.env) (use safe local credentials):
```ini
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
JWT_SECRET=nexus_erp_dev_secret_key_must_be_at_least_32_characters_long

# Database Configuration (PostgreSQL 16 in Docker on port 5433)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nexus_erp?schema=public

# Initial Admin Bootstrap Configuration (for prisma/seed-admin.ts)
BOOTSTRAP_ADMIN_EMAIL=admin@nexus.local
BOOTSTRAP_ADMIN_FIRST_NAME=Suresh
BOOTSTRAP_ADMIN_LAST_NAME=Achanta
BOOTSTRAP_ADMIN_PASSWORD=AdminPassword123!
```

### 8.3 Starting the PostgreSQL Container
```powershell
# Start PostgreSQL on port 5433
docker run --name nexus-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nexus_erp -p 5433:5432 -d postgres:16-alpine

# If the container already exists, start it:
docker start nexus-postgres
```

### 8.4 Installing Dependencies & Running Migrations
```bash
# In backend directory:
cd backend
npm install
npx prisma migrate deploy
npm run prisma:generate

# In frontend directory:
cd ../frontend
npm install
```

### 8.5 Running the Applications
```bash
# Terminal 1: Start Backend Dev Server (Port 3000)
cd backend
npm run start:dev

# Terminal 2: Start Frontend Dev Server (Port 5173)
cd frontend
npm run dev
```
- **Backend API:** `http://localhost:3000/api`
- **Frontend Dashboard:** `http://localhost:5173`

---

## 9. Testing & Verification Architecture

### 9.1 Unit Testing (`npm test`)
Executes 61 tests across 10 test suites via `node:test` and `ts-node`:
```bash
cd backend
npm test
```
**Latest Test Run Verification:**
- `AuthService & LoginDto Regression Tests`: 8 passed
- `FinanceLoanService`: 15 passed
- `FinanceLoanController`: 5 passed
- `GeneralLedgerService`: 25 passed across 5 sub-suites
- `GeneralLedgerController`: 8 passed
- **Total:** **61 passed, 0 failed, 0 skipped** (Execution time: ~2.3 seconds)

### 9.2 Real Database Integration Testing (`npm run test:integration`)
Executes real PostgreSQL queries against `nexus-postgres` on port 5433:
```bash
cd backend
npm run test:integration
```
**Verified Scenarios (15 tests in `general-ledger.integration.spec.ts`):**
1. Account creation, query filtering, and code unique constraint collision (`P2002`).
2. Multi-line journal entry atomic insertion and double-entry balancing in PostgreSQL.
3. Transaction rollback on unbalanced entries (verifying zero records written).
4. Inactive account rejection and cross-branch account isolation.
5. Compound unique idempotency on `(sourceModule, sourceReference)`.
6. Foreign key enforcement on `JournalLine.accountId` (`ON DELETE RESTRICT`).
7. Draft $\rightarrow$ Posted $\rightarrow$ Void lifecycle in PostgreSQL with audit narration preservation.
8. Non-admin branch security vs. `SYSTEM_ADMIN` global posting rights.
9. 100% clean teardown (deleting test records in dependency order).

### 9.3 Build and Lint Verification
```bash
cd backend
npm run lint    # ESLint check (0 errors, 0 warnings)
npm run build   # NestJS compilation (nest build - exit code 0)
npx prisma validate # Prisma schema validation (Valid 🚀)
```

---

## 10. Completed Work Breakdown

| Subsystem / Feature | Relevant Source File Paths | Implementation Details |
| :--- | :--- | :--- |
| **Loan Data Model** | `backend/prisma/schema.prisma`<br>`backend/prisma/migrations/20261019110838_add_loan_applications/` | `LoanStatus` enum, `LoanApplication` model with indexes and decimal amounts. |
| **Loan API & FSM** | `backend/src/modules/finance-loan/finance-loan.service.ts`<br>`backend/src/modules/finance-loan/finance-loan.controller.ts` | 5 endpoints, 6-state FSM transitions, 2% auto-commission, branch-level multi-tenancy. |
| **Loan DTOs** | `backend/src/modules/finance-loan/dto/create-loan.dto.ts`<br>`backend/src/modules/finance-loan/dto/update-loan-status.dto.ts`<br>`backend/src/modules/finance-loan/dto/loan-query.dto.ts` | Complete class-validator decorators, numeric limits, string trimming. |
| **General Ledger Models** | `backend/prisma/schema.prisma`<br>`backend/prisma/migrations/20261022144500_add_general_ledger_foundation/` | `Account`, `JournalEntry`, `JournalLine` models, composite unique index on `(sourceModule, sourceReference)`. |
| **General Ledger Engine** | `backend/src/modules/general-ledger/general-ledger.service.ts`<br>`backend/src/modules/general-ledger/general-ledger.controller.ts` | 8 endpoints, integer-cent balancing, draft/post/void workflows, external transaction client support (`externalTx`). |
| **General Ledger DTOs** | `backend/src/modules/general-ledger/dto/*.dto.ts` | 6 DTO files covering account creation, journal entry creation, lines, and queries. |
| **Unit Test Coverage** | `backend/src/modules/auth/auth.service.spec.ts`<br>`backend/src/modules/finance-loan/*.spec.ts`<br>`backend/src/modules/general-ledger/*.spec.ts` | 61 unit tests covering auth, finance loan, and general ledger services/controllers. |
| **Integration Test Suite** | `backend/src/modules/general-ledger/general-ledger.integration.spec.ts` | 15 real PostgreSQL integration tests validating constraints, transactions, and isolation. |
| **Architectural Specs** | `backend/docs/*.md` | Comprehensive API specs, integration readiness audits, and stakeholder approval documents. |

---

## 11. Pending Work & Known Gaps

The following tasks are **pending design approval, technical implementation, or external inputs**:

1. **Atomic Finance-to-GL Integration:** `FinanceLoanService.updateStatus()` does not yet call `GeneralLedgerService.createJournalEntry()`. Cross-module atomic transaction is designed but not implemented.
2. **Tally ERP Chart of Accounts Mapping:** The company maintains official books in Tally ERP without numeric account codes. An official Tally COA export is required to map actual Tally ledger names to Nexus ERP accounts.
3. **Illustrative vs. Official Account Codes:** Numeric codes `1100`, `1150`, `4300`, and `2100` are purely illustrative proposed engineering placeholders. No official company account codes exist until confirmed by finance.
4. **GST Policy Confirmation:** No approved tax policy exists. The Finance Controller must confirm whether commission is inclusive/exclusive of GST and when GST liability should be recognized.
5. **Zero-Commission Policy:** A business decision is required confirming that loans with ₹0 commission can disburse while bypassing General Ledger entry creation.
6. **Disbursement Authorization (RBAC):** `FINANCE_MANAGER` role and `LOAN_DISBURSE` permissions need to be seeded in `seed-admin.ts` and enforced via guards.
7. **Reversal / Cancellation Workflow:** `REVERSED` is not an existing enum value in `LoanStatus`. Introducing it requires a Prisma schema update, migration, and service logic.
8. **Frontend REST API Integration:** `FinanceLoan.tsx` and `FinanceAccounting.tsx` currently operate on static in-memory arrays and do not make live HTTP calls to the backend API.
9. **Tally Bridge Decision:** A high-level decision is required on whether Tally remains the sole authoritative GL (with Nexus exporting vouchers) or whether Nexus ERP operates an autonomous ledger.
10. **End-to-End Testing:** End-to-end HTTP integration tests combining auth JWT, loan origination, disbursement, and ledger verification.

---

## 12. Finance-to-GL Integration Design (Proposed)

> **Implementation Notice:** This design is **PROPOSED — PENDING FINANCE APPROVAL**. Do not implement until official ledger names and tax treatment are confirmed by Akash and the Finance Controller.

### 12.1 Transactional Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Officer as Dealership User
    participant Controller as FinanceLoanController
    participant LoanService as FinanceLoanService
    participant GLService as GeneralLedgerService
    participant DB as PostgreSQL (Prisma $transaction)

    Officer->>Controller: PATCH /api/finance/loans/:id/status {"status": "DISBURSED"}
    Controller->>LoanService: updateStatus(user, id, dto)
    
    LoanService->>DB: prisma.$transaction(async (tx) => ...)
    activate DB
    Note over DB: 1. SELECT loan FOR UPDATE & verify status == SANCTIONED
    Note over DB: 2. UPDATE LoanApplication SET status = 'DISBURSED'
    
    opt If commissionAmount > 0
        LoanService->>GLService: createJournalEntry(user, journalDto, tx)
        Note over DB: 3. Resolve Account IDs (Receivable & Revenue)
        Note over DB: 4. INSERT JournalEntry (sourceModule='FINANCE_LOAN', sourceReference=loan.id)
        Note over DB: 5. INSERT JournalLines (Debit: Receivable, Credit: Revenue)
    end
    
    alt Any Failure (Validation, Inactive Account, DB Error)
        DB-->>LoanService: Rollback Transaction
        LoanService-->>Controller: Exception (400 / 409 / 422)
        Controller-->>Officer: Error (Loan remains SANCTIONED)
    else Success
        DB-->>LoanService: Commit Transaction
        deactivate DB
        LoanService-->>Controller: Updated LoanApplication
        Controller-->>Officer: HTTP 200 OK
    end
```

### 12.2 Key Invariants of the Proposed Integration
1. **Single Atomic Boundary:** The status update to `DISBURSED` and the journal entry insertion must share the exact same `tx: Prisma.TransactionClient`. If either fails, both roll back.
2. **Stable Source Reference Idempotency:** The journal entry sets `sourceModule: 'FINANCE_LOAN'` and `sourceReference: loan.id`. PostgreSQL's `@@unique([sourceModule, sourceReference])` guarantees that multiple requests cannot create duplicate financial entries.
3. **Zero-Commission Handling:** If `loan.commissionAmount === 0`, the journal entry call is bypassed, allowing vehicle delivery without violating double-entry invariants.

---

## 13. Existing Documentation Index

The following engineering documents are maintained in [`backend/docs/`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/):

1. [**`finance-loan-api.md`**](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/finance-loan-api.md): Exhaustive REST API contract, DTO definitions, status code specifications, and curl examples for the Finance & Loan Desk module.
2. [**`general-ledger-design.md`**](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/general-ledger-design.md): In-depth design of the General Ledger foundation, double-entry mathematical invariants, schema models, and transaction handling.
3. [**`finance-loan-ledger-integration-plan.md`**](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/finance-loan-ledger-integration-plan.md): Initial architectural blueprint for cross-module disbursement posting.
4. [**`finance-gl-integration-readiness.md`**](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/finance-gl-integration-readiness.md): Technical readiness audit detailing gaps, transaction handling, and test matrices.
5. [**`finance-gl-integration-approval.md`**](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/finance-gl-integration-approval.md): Formal stakeholder approval request featuring company Tally context and the 8-point decision matrix.
6. [**`nexus-erp-project-status-handover.md`**](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/nexus-erp-project-status-handover.md): High-level project audit and status handover.

---

## 14. Handover Checklist for Sravya

Use this checklist during your first week on the project:

- [ ] **Repository Access & Environment:**
  - [ ] Clone repository from `Nova5tech/Nexus_ERP.git`.
  - [ ] Check out working branch `feature/finance-loan-backend-v2`.
  - [ ] Verify Node.js v20+ and Docker Desktop are operational.
- [ ] **Database & Migrations:**
  - [ ] Start `nexus-postgres` container on port `5433`.
  - [ ] Configure `backend/.env` with local credentials.
  - [ ] Run `npx prisma migrate status` to confirm all 3 migrations are applied.
  - [ ] Run `npm run prisma:generate` to regenerate Prisma Client.
- [ ] **Codebase Familiarization:**
  - [ ] Read `backend/docs/nexus-erp-developer-handover.md` (this document).
  - [ ] Inspect `backend/prisma/schema.prisma` models and enums.
  - [ ] Walk through `FinanceLoanService` and `FinanceLoanController`.
  - [ ] Walk through `GeneralLedgerService` and `GeneralLedgerController`.
  - [ ] Review `seed-admin.ts` to understand bootstrap user creation.
- [ ] **Verification & Testing:**
  - [ ] Run `npm test` in `backend/` and verify all 61 tests pass.
  - [ ] Run `npm run test:integration` and verify all 15 real DB tests pass.
  - [ ] Run `npm run lint` and verify 0 errors / 0 warnings.
  - [ ] Run `npm run build` and verify clean NestJS compilation.
  - [ ] Start backend (`npm run start:dev`) and frontend (`npm run dev`) and test UI.
- [ ] **Stakeholder Alignment:**
  - [ ] Meet with Akash (Finance Lead) regarding [`finance-gl-integration-approval.md`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/finance-gl-integration-approval.md).
  - [ ] Request the official Tally ERP Chart of Accounts export and sample commission journal voucher.

---

## 15. Recommended Next Tasks (Prioritized)

```mermaid
flowchart TD
    T1["1. Obtain Tally COA & Sample Journal from Akash"] --> T2["2. Seed Approved Accounts into PostgreSQL"]
    T2 --> T3["3. Build Account Resolver Helper in Backend"]
    T3 --> T4["4. Implement Atomic $transaction in updateStatus()"]
    T4 --> T5["5. Write Cross-Module Unit & Integration Tests"]
    T5 --> T6["6. Connect Frontend UI to Backend REST Endpoints"]
    T6 --> T7["7. Implement Reversal Flow (Add REVERSED Enum)"]
```

### Phase 1: Accounting Alignment (Prerequisite)
1. **Obtain Tally Artifacts:** Secure an official Tally Chart of Accounts export and a sample commission voucher from Kumar/Akash.
2. **Finalize Decision Matrix:** Get sign-off on the 8 decision points in [`finance-gl-integration-approval.md`](file:///c:/Users/goudt/OneDrive/Desktop/intern/ERP/backend/docs/finance-gl-integration-approval.md).

### Phase 2: Backend Cross-Module Integration (Once Approved)
3. **Seed Accounts:** Write a seed script populating the approved Commission Receivable and Commission Revenue accounts into PostgreSQL.
4. **Account Resolver Helper:** Build a helper in `FinanceLoanService` (or shared ledger config) that resolves the active database UUIDs for configured accounts.
5. **Implement Atomic Disbursement:**
   - Import `GeneralLedgerModule` into `FinanceLoanModule`.
   - Wrap status update and journal creation inside `this.prisma.$transaction(async (tx) => ...)`.
   - Pass `tx` into `ledgerService.createJournalEntry(user, dto, tx)`.
   - Handle ₹0 commission bypass.
6. **Automated Tests:** Add unit tests verifying rollback on ledger failure, and real integration tests verifying atomic commit.

### Phase 3: Frontend Integration & Enhancements
7. **Connect `FinanceLoan.tsx`:** Replace in-memory array with Axios/Fetch calls to `GET /api/finance/loans`, `POST /api/finance/loans`, and `PATCH /api/finance/loans/:id/status`.
8. **Implement RBAC & Reversals:** If authorized by management, add `REVERSED` to `LoanStatus`, generate a migration, and add the reversal endpoint.

---

## 16. Glossary & Technical Definitions

- **ACID:** Set of properties (Atomicity, Consistency, Isolation, Durability) ensuring reliable database transactions. In Nexus ERP, loans and ledger entries are committed or rolled back atomically.
- **CUID:** Collision-resistant Unique Identifier. Used as primary keys across all Prisma models in Nexus ERP (e.g., `cuid()`).
- **Double-Entry Bookkeeping:** Accounting principle where every transaction requires equal debit and credit amounts ($\sum \text{Debits} == \sum \text{Credits}$).
- **DTO (Data Transfer Object):** Class defining the exact shape and validation rules of request/response payloads using `class-validator` and `class-transformer`.
- **FSM (Finite State Machine):** Mathematical model of computation where an entity is in exactly one state at a time. Used in `FinanceLoanService` to control allowed loan transitions.
- **Idempotency:** Property where an operation can be applied multiple times without changing the result beyond the initial application. Enforced via composite unique key `(sourceModule, sourceReference)`.
- **Integer Cents:** Representing currency as integer cents (e.g. `100.50` stored/calculated as `10050` cents) to avoid floating-point rounding errors.
- **JWT (JSON Web Token):** Compact, URL-safe means of representing claims between two parties. Used for stateless Bearer authentication in Nexus ERP.
- **Migration:** Structured, version-controlled SQL script that alters the database schema incrementally.
- **Modular Monolith:** Software architecture where logically independent modules reside in a single codebase and deployment unit.
- **ORM (Object-Relational Mapping):** Technology (Prisma 7 in Nexus ERP) bridging database tables and TypeScript classes.
- **RBAC (Role-Based Access Control):** Restricting system access based on user roles and assigned granular permissions.
- **Transaction (`$transaction`):** Mechanism in Prisma bundling multiple queries into a single atomic database operation.
