# Nexus ERP

Nexus ERP is a modular automotive dealership enterprise resource planning platform. This repository is structured as a two-tier monorepo with an independent React frontend and a NestJS backend foundation.

---

## Repository Structure

```text
nexus-erp/
├── README.md              # Root monorepo guide (this file)
├── .gitignore             # Root gitignore for frontend and backend
├── frontend/              # Dealership Web Application (React + Vite + TypeScript)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   ├── eslint.config.js
│   ├── .env.example
│   ├── public/
│   └── src/
│       ├── layouts/       # Global shell, sidebar, and headers
│       ├── modules/       # Dashboard, Finance, HR, TDS/TCS
│       └── routes/        # Application route definitions
└── backend/               # Modular Monolith API Foundation (NestJS + TypeScript)
    ├── package.json
    ├── nest-cli.json
    ├── tsconfig*.json
    ├── .env.example
    └── src/
        ├── main.ts        # Bootstrap entry point (Global prefix: /api)
        ├── app.module.ts  # Root application module
        └── modules/
            └── health/    # Initial health check module (/api/health)
```

> **Note on Workspace Tooling:** Per project design, `frontend/` and `backend/` are managed and run as independent packages. There are no npm workspaces or monorepo orchestrators (Turborepo, Nx, Lerna) enabled.

---

## Frontend Setup & Execution

The frontend is a single-page application built with React 19, TypeScript, Vite, and Tailwind CSS.

### 1. Navigate to the Frontend Directory
```bash
cd frontend
```

### 2. Environment Configuration
Create a local `.env.local` file from the example:
```bash
cp .env.example .env.local
```
*(On Windows PowerShell: `Copy-Item .env.example .env.local`)*

Default configuration in `.env.example`:
```ini
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Available Scripts
- **Start Development Server:**
  ```bash
  npm run dev
  ```
  The Vite dev server will start (default: `http://localhost:5173`).
- **Build for Production:**
  ```bash
  npm run build
  ```
- **Lint Code:**
  ```bash
  npm run lint
  ```
- **Preview Production Build:**
  ```bash
  npm run preview
  ```

---

## Backend Setup & Execution

The backend is a modular monolith API built with NestJS and TypeScript.

### 1. Navigate to the Backend Directory
```bash
cd backend
```

### 2. Environment Configuration
Create a local `.env` file from the example:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Default configuration placeholders in `.env.example`:
```ini
PORT=3000
NODE_ENV=development

# Database (Target: PostgreSQL 16)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=nexus_erp

# Caching & Background Jobs (Target: Redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Available Scripts
- **Start Development Server (with hot reload):**
  ```bash
  npm run start:dev
  ```
- **Build Application:**
  ```bash
  npm run build
  ```
- **Start Production Server:**
  ```bash
  npm run start:prod
  ```

### 5. Health Check Endpoint
Once running, verify backend operation:
```bash
curl http://localhost:3000/api/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-15T12:00:00.000Z",
  "uptime": 12.34,
  "service": "nexus-erp-backend"
}
```

---

## Architecture & Roadmap

- **Modular Monolith Architecture:** The backend is organized under `backend/src/modules/` so domain modules (`auth`, `finance-loan`, `finance-accounting`, `hr-payroll`, `tds-tcs`, `exchange-vehicles`) can be added cleanly as isolated modules within a single deployment unit.
- **Database (PostgreSQL 16):** Database integration and ORM selection (e.g., Prisma, TypeORM, or Drizzle) will be implemented once chosen by the engineering team.
- **Caching & Queues (Redis):** Caching and background job processors will be integrated alongside respective domain modules.
- **Business Logic & SRS:** ERP domain fields and workflows will be implemented following signed-off Software Requirements Specifications (SRS).
