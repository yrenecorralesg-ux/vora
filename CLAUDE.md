# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

VORA (by Venesoft) is a modular, multitenant SaaS business platform (CRM, POS, Warehouse, billing…) built on Next.js 13.5 App Router + Supabase. UI text, docs and error messages are in Spanish; keep new user-facing strings in Spanish.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build (ESLint is skipped during build — run lint separately)
npm run lint         # next lint
npm run typecheck    # tsc --noEmit
```

There is no test framework; tests are standalone Node scripts in `scripts/`, run individually:

```bash
node scripts/test-core-routes.cjs        # middleware + route handlers (transpiles TS with `typescript`, mocks Supabase)
node scripts/test-tenant-preview.cjs
node scripts/test-tenant-users.cjs
node scripts/test-invitation-routes.cjs
node scripts/test-client-dashboard.cjs
node scripts/test-demo-mail.cjs
# PostgreSQL migration/RLS tests in PGlite (no Supabase connection). Install pglite in a temp dir,
# NOT as a project dependency, then pass its absolute package path:
node scripts/test-core.cjs <abs-path-to>/node_modules/@electric-sql/pglite
node scripts/test-warehouse.cjs <abs-path-to>/node_modules/@electric-sql/pglite   # Warehouse ledger/RLS/idempotency
node scripts/test-pos.cjs <abs-path-to>/node_modules/@electric-sql/pglite         # POS shifts/sales/returns persistence
```

`test-core.cjs` replays every file in `supabase/migrations/` in sorted order (skipping the consolidated `20261006000000_initial_schema.sql`), so any new migration must apply cleanly in PGlite on top of the previous ones.

Env vars: copy `.env.example` → `.env` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Resend vars, and per-tenant `secret_ref` vars for Dedicated tenants).

## Architecture

### Platform vs. tenant
- **Platform DB** (one Supabase project) holds tenants, memberships, roles/permissions, features/modules, plans, subscriptions, domains, audit. Migrations live in `supabase/migrations/` and are additive — never edit or re-run historical migrations; add a new timestamped file. Migrations must not insert fake/demo data; dev-only demo data lives in `supabase/seeds/` (e.g. `dev_pos_test1.sql`, the POS pilot tenant) and is run by hand.
- Each tenant has an immutable **infrastructure mode**:
  - `shared`: data lives in the platform DB with `tenant_id` columns + RLS.
  - `dedicated`: a separate Supabase project; its service key is read from the env var named by `tenant_databases.secret_ref` (`lib/tenant-connection.ts`).
- `lib/tenant-data.ts` → `resolveTenantData(slug)` is the intended server-side entry point for module data: checks session, membership (or super admin), tenant status and DB connection, then returns the right client. Shared-mode queries must still filter by `tenant_id`.

### Routing & multitenancy (`middleware.ts`, `lib/core-config.ts`)
- Super admin console: `/admin/*` (+ `/api/admin/*`). Tenant app: `/t/[slug]/*` (+ `/api/t/[slug]/*`).
- Tenant subdomains (`<slug>.<VORA_DOMAIN>`, or `<slug>.localhost` in dev) are resolved by middleware and rewritten to `/t/<slug>/...`; cross-tenant paths return 403 and `/admin` is redirected to the main domain.
- Middleware sets `x-vora-path` and `x-vora-preview` request headers. Preview mode (`?preview=1`) is only honored server-side for super admins (lets them view a tenant that isn't `ready`).
- Unauthenticated access is redirected to `/login` or `/t/<slug>/login`. There is no cookie bypass: `/t/*` requires a Supabase session (route tests assert a forged `vora_pos_session` cookie does not skip login).
- `/api/tenant-domain-check` and `/api/t/[slug]/branding` are public.

### Auth & authorization
- `lib/supabase-server.ts`: `getSupabaseServerClient()` (cookie session, anon key, RLS applies) vs. `getSupabaseServiceClient()` (service role, bypasses RLS — server only, only after an explicit authorization check). Browser client in `lib/supabase-client.ts`.
- `lib/auth.ts`: `requireSession`, `isSuperAdmin`, `requireSuperAdmin`, `getUserMemberships`, `checkPosPermission`.
- `lib/tenant-access.ts`: page guards for server components — `requireTenantFeature(slug, featureKey)` (membership + tenant `ready`/not suspended + feature `enabled` AND `contracted`) and `requirePosPermission(slug, permission)` (role → `role_permissions`).
- Roles: platform `super_admin`; tenant roles `tenant_admin` (all permissions), POS `pos_store_admin`/`pos_supervisor`/`pos_cashier`/`pos_sales_rep`/`pos_auditor`, Warehouse `wh_manager`/`wh_supervisor`/`wh_clerk`/`wh_scanner`/`wh_auditor`, and `member` (CRM access only). A role only grants what `role_permissions` lists for it. Entitlements (tenant contracted a module) and permissions (user may perform an action) are separate and both enforced on the backend.
- API route pattern for `/api/t/[slug]/*`: start every handler with `const auth = await authorizeTenantApi(params.slug); if (!auth.ok) return auth.response;` (`lib/tenant-api-auth.ts`: session + active membership or super admin), then query with the service client filtered by `auth.access.tenantId`. `scripts/test-core-routes.cjs` asserts every POS/Warehouse handler returns 401 to anonymous callers, so new handlers there are covered automatically.

### Modules / feature flags
- `lib/modules-config.ts` → `CRM_MODULES_CATALOG`: each module key (e.g. `crm.customers`, `commerce.pos`, warehouse modules) has a category, `href` and a list of toggleable functions. Per-tenant enablement is stored in `tenant_features` (and module functions), managed from the admin tenant detail (`components/tenant-tabs.tsx`, `components/tenant-modules-config.tsx`) and surfaced in `components/crm-sidebar.tsx`.
- Modules with status `planned` cannot be activated (activation endpoints return 409).
- `Docs Iniciales/Vora Warehouse/VORA_ARQUITECTURA_MAESTRA.md` is the target module catalog (stable IDs, dependencies, principles such as outbox events, pending/verified/rejected payment states). It is a design document, not a description of what is built.

### Module implementation status
- **Legacy CRM pages** (`/t/[slug]/customers`, `sales`, `orders`, …) render static fixtures from `lib/demo-data.ts` and show a demo banner.
- **POS** (`/t/[slug]/pos`, `components/pos/`, `app/api/t/[slug]/pos/*`): a client-side SPA driven by `pos-context.tsx` with numbered views (`pos-view-NN-*.tsx`). **Supabase is the source of truth** (migration `20261121000000_pos_server_persistence.sql`, server layer `lib/pos/server.ts`):
  - Shifts, cash movements, sales, returns and credit payments go through `service_role`-only functions (`pos_open_shift`, `pos_add_cash_movement`, `pos_close_shift`, `pos_record_sale`, `pos_record_return`, `pos_record_debt_payment`) called with `p_tenant` + `p_actor` after `authorizeTenantApi` + `hasTenantPermission` (role → `role_permissions`). The old `vora_pos_*` RPCs are not used.
  - The server re-prices every sale from the catalog (`buildSalePayload`): the browser only sends product, quantity, discount % and payments. A sale and its stock exit are one transaction; with the Warehouse catalog stock never goes negative.
  - Catalog source is per tenant: `commerce.pos` → `config.catalog_source` = `warehouse` (`warehouse_items`) or `pos` (`pos_products`, with `pos_stock_policy`), set in the admin modules tab.
  - Supervisor approvals (discount above the cashier limit, returns, cash withdrawals) use a personal PIN hashed with scrypt in `pos_staff_pins` (`/api/t/[slug]/pos/pin`, `/authorizations`), never a shared or client-side PIN.
  - `posStore` (`lib/pos-service.ts`) only builds the provisional receipt of an offline sale in the browser; the offline queue (`lib/pos-offline.ts`) replays with the same idempotency key and stops retrying definitive 4xx rejections.
  - Providers: The Factory HKA (`pos-hka-provider.ts`, credentials from env vars `<secret_reference>_USER/_PASSWORD`, config in `pos_fiscal_integrations`) and Cashea. Venezuelan context: Bs/USD rate stored in `pos_tenant_settings`, IVA 16%, IGTF 3%, SENIAT sales book. Requirements: `FUNCIONALIDADES_Y_REQUERIMIENTOS_MODULO_POS.txt` and related root `.txt` files.
- **Warehouse** (`/t/[slug]/warehouse/*`, `app/api/t/[slug]/warehouse/*`, `lib/warehouse/`, `components/warehouse/`): built against the spec `Docs Iniciales/Vora Warehouse/VORA_Warehouse_Definicion_Integral_40_Vistas_v2.pdf`; each page's doc comment names its view code (WH-01…WH-27). Schema in `supabase/migrations/20261117030000_warehouse_core_schema.sql`:
  - Stock changes ONLY through `warehouse_apply_movement()` (locks the balance row, never negative, weighted-average cost, idempotency key). `warehouse_movements` is immutable (trigger); corrections are reversals.
  - Documents (receipt/issue/adjustment/return) go through `warehouse_create_document` / `warehouse_post_document`; POS sales through `warehouse_register_pos_event`; imports through `warehouse_apply_import`. These functions are `service_role`-only; API routes call them after `authorizeWarehouse()` (`lib/warehouse/access.ts`: membership + `warehouse.inventory` contracted/enabled + role permissions from `role_permissions`, with `tenant_admin`/super admin getting all). Pages use `requireWarehousePage()`.
  - Services and rental assets have `track_stock = false` (generated column). Damaged returns go to the `damaged` bucket, not sellable stock.
  - Imports are CSV only for now (XLSX pending approval of the `exceljs` dependency).
  - Per-tenant role matrix (`tenant_role_matrix`, overrides only Warehouse permissions; `resolveRolePermissions`) and per-user warehouse scopes (`warehouse_user_scopes`, `ctx.canUseWarehouse`) — enforce the scope in every route that takes a warehouse.
  - Transfers via `warehouse_ship_transfer` / `warehouse_close_transfer` (stock goes to `in_transit` at the destination until received). Adjustment evidence lives in the private Storage bucket `warehouse-evidence`. Scheduled reports: `warehouse_report_schedules` + `/api/cron/warehouse-reports` (Vercel Cron, `CRON_SECRET`).
  - UI building blocks are in `components/warehouse/wh-ui.tsx` (`btn`, `field`, `Kpi`, `Panel`, `DataTable`, `EmptyState`); keep the wireframe look (green sidebar, cream background, white cards).
- **Core / subscriptions** (`docs/vora-core-progressive.md`): atomic tenant creation via the `vora_create_tenant` SQL function, Pago Móvil subscription charges with manual review, Venezuela/USD/America/Caracas defaults (`venezuelaDate()` in `lib/core-config.ts`).

### UI
shadcn/ui (Radix) components in `components/ui/`, Tailwind, `lucide-react` icons, `recharts`. Path alias `@/*` → repo root. Each tenant has its own branding (colors, font, logo) applied in `app/t/[slug]/layout.tsx`; global VORA branding is green.

## Docs
`docs/` contains detailed (Spanish) documentation: `architecture.md`, `multitenancy.md`, `security.md`, `database.md`, `feature-flags.md`, `migrations.md`, `deployment.md` (Vercel primary, Netlify via `netlify.toml`), `vora-core-progressive.md` (current core flow and test procedure), `handoff.md`.
