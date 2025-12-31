# Next.js Prisma Enterprise Starter

This project is built on a strict **Project Constitution** to ensure scalability, security, and accounting integrity.

## Project Constitution (Non-Negotiable Rules)

### 0.1 Tech Rules
- **Framework**: Single Next.js (App Router) app.
- **Architecture**: Frontend + Backend in the same app (Monorepo-style).
- **Pattern**: Strict MVC (Model-View-Controller).
- **Routes**: No business logic in routes. Handlers delegate to Controllers -> Services -> Helpers.
- **Database**: Prisma ORM (LTS versions only).
- **Data Integrity**: Soft delete everywhere. Audit logs are mandatory for all write operations.

### 0.2 Accounting Rules
- **No Direct Ledger Posting**: All financial impacts must go through Vouchers or Journal Vouchers (JVs).
- **Voucher Numbering**: Automatic, sequential numbering based on voucher nature.
- **Fiscal Discipline**: Financial year lock must be respected at both DB and API levels.

### 0.3 Core Database Foundations
#### Master Tables
- `companies`, `financial_years`
- `currencies`, `units`
- `tax_codes` (GST, VAT, etc.)

#### Security Tables
- `users`, `roles`, `permissions`
- `role_permissions`, `user_role_limits`

### 0.4 Auth System (RBAC + ABAC)
- **RBAC**: Role -> Permissions mapping (Module/Action based).
- **ABAC**: Attribute-based checks (Warehouse access, Amount limits, Date ranges).
- **Security**:
    - Force password change on first login.
    - Invalidate tokens after password change.
    - Mandatory session audit logging.

### 0.5 Financial Year Engine
- Only **ONE** active year at a time.
- Opening a new year requires a secure key hash.
- **Guards**: Middleware must block posting in closed or unopened years.
- **Year Close**: Generates a closing JV and permanently locks the year.

### 0.6 Global Settings Engine
- Key-Value store for: Currency, Tax Mode, GRN/DO Mandatory flags, Theme, formatting rules.

### 0.7 Audit Logs
- **Capture**: `user_id`, `action`, `module`, `before_state`, `after_state`, `timestamp`, `ip_address`.
- **UI**: detailed filtering by user, module, and date.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
