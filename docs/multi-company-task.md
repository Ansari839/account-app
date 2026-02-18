# Multi-Company Support — Task Breakdown

## Phase 1: Schema + Migration
- [x] Add `UserCompany` model
- [x] Add `companyId` to all models (20+ tables)
- [x] Update unique constraints to compound `@@unique([companyId, ...])`
- [x] Rename `GlobalSetting` → `CompanySetting` (13 files updated)
- [x] Run `prisma generate`
- [ ] Run `prisma migrate dev` ⚠️ User action needed
- [x] Create data migration script (`scripts/migrate-multicompany.ts`)

## Phase 2: Auth + Company Selection
- [x] Update `auth.service.ts` — return companies list on login
- [x] Update JWT token (userId only, no hardcoded companyId)
- [x] Middleware: `X-Company-Id` header passthrough + no-company route exemptions
- [x] Company Selector Page (`app/auth/select-company/page.tsx`)
- [x] `CompanyContext` (React Context) + `CompanyProvider` in root layout
- [x] `api-client.ts` auto-inject `X-Company-Id` header
- [x] Login page updated — routes to selector for multi-company

## Phase 3: Service Layer Updates (17+ services)
- [ ] `account`, `voucher`, `financial-year`, `purchase`, `sales`
- [ ] `product`, `party`, `category`, `warehouse`, `journal`
- [ ] `stock`, `report`, `closing`, `settings`, `tax`, `rbac`, `audit`

## Phase 4: API Routes Update
- [ ] `getCompanyId()` helper for all routes
- [ ] Update purchase, sales, finance, inventory, settings routes

## Phase 5: Frontend Changes
- [ ] API client auto-inject `X-Company-Id`
- [ ] Company switcher in sidebar
- [ ] All forms/lists filter by active company
- [ ] Voucher settings UI per company

## Phase 6: Admin Panel
- [ ] 6A: Global Admin (User CRUD, Company CRUD, User↔Company assign)
- [ ] 6B: In-Company Settings (RBAC, Voucher Config, Fiscal Year)

## Phase 7: Consolidated Reports (Super Admin)
- [ ] Combined Trial Balance, P&L, Balance Sheet
- [ ] Company-wise summary comparison
- [ ] Access control (only accessible companies)

## Phase 8: Backup & Restore
- [ ] Company data export (JSON)
- [ ] Import/restore with confirmation
- [ ] Selective export (master data vs full)

## Phase 9: Role-Based Dashboards
- [ ] OWNER/SUPER_ADMIN dashboard (full overview)
- [ ] ACCOUNTANT dashboard
- [ ] SALES dashboard
- [ ] PURCHASE dashboard
- [ ] WAREHOUSE dashboard

## Phase 10: Extra Features
- [ ] Company Template/Clone
- [ ] Enhanced Activity Log (per company)
- [ ] Quick Company Switch (sidebar dropdown)
- [ ] Prisma Safety Middleware (auto companyId injection)
- [ ] Company Selector Dashboard Cards (quick stats)
