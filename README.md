# Nexus ERP — Combined Application

This folder merges the two separately built copies of Nexus ERP into one application:

| Source folder | What it contributed |
|---|---|
| `Nexus_ERP/Nexus_ERP` (base) | Real JWT login, Finance & Loan Desk, General Ledger, Lender master, branch-aware layout |
| `Nexus-ERP-Project-Share` | Exchange / Used Vehicles backend (inspection, valuation, RC Book OCR & authenticity), full Exchange Vehicles UI, AI Copilot panel, dashboard |

One NestJS backend (`backend/`, all modules under `/api`), one React frontend (`frontend/`), one PostgreSQL database with all 16 migrations.

## Run locally (one command)

```bash
npm run install:all   # first time only
npm run dev           # starts PostgreSQL (port 5433), the API (3000) and the web app (5173)
npm run db:seed       # first time only, in a second terminal while `npm run dev` is running
```

- Web app: http://localhost:5173 — sign in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` from `backend/.env`
- API health: http://localhost:3000/api/health

PostgreSQL runs from the `embedded-postgres` npm package (no Docker or system install). Its data is kept in `.local-db/`. To use your own PostgreSQL instead, change `DATABASE_URL` in `backend/.env` and run `npm run db:migrate` + `npm run backend` + `npm run frontend`.

The original per-module guide is in `README.original.md`.

## Local login accounts (created by `npm run db:seed`)

| Account | Role | Sidebar shows |
|---|---|---|
| `admin@nexus.local` (password: `BOOTSTRAP_ADMIN_PASSWORD` in `backend/.env`) | SYSTEM_ADMIN | everything |
| `admin@nexuserp.demo` | SYSTEM_ADMIN | everything |
| `finance.manager@nexuserp.demo` | FINANCE_MANAGER (can sanction/disburse) | Dashboard, Finance & Loan, Finance & Accounting |
| `finance.executive@nexuserp.demo` | FINANCE_EXECUTIVE | Dashboard, Finance & Loan, Finance & Accounting |
| `hr.manager@nexuserp.demo` | HR_MANAGER | Dashboard, HR & Payroll |
| `vehicles@nexuserp.demo` | USED_VEHICLES_EXECUTIVE | Dashboard, Exchange / Used Vehicles |
| `compliance@nexuserp.demo` | COMPLIANCE_OFFICER | Dashboard, TDS / TCS |
| branch staff `*.kkd/.tnk/.nrp/.elr/.ho@nexus.local` (password: `ChooseATemporaryPassword`, set by `BRANCH_USER_PASSWORD` in `backend/.env`) | none (sanjeev.ho = FINANCE_MANAGER) | everything, own branch only |

The `@nexuserp.demo` passwords are the same as the old demo login screen — see `backend/prisma/seed-demo-employees.ts`.
