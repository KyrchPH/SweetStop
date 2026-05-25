# SweetStop POS Monorepo

Monorepo setup for SweetStop POS with:
- `client`: Vite + React (JavaScript)
- `server`: Node.js + Express (JavaScript)

## App Features

1. Global product catalog management.
2. Product variant management (add variants per product).
3. Branch-based catalog customization.
4. Branch availability controls (`applicable`, `hidden`, manual unavailable, scheduled unavailable period).
5. Branch inventory and stock status tracking.
6. User access control with roles and permissions.
7. Cashier order entry with automatic subtotal and total calculation.
8. Manual cash amount input with automatic change calculation.
9. Receipt generation for each recorded sale.
10. Receipt reprint and void support with auditability.
11. Product sales reporting.
12. Daily summary reporting with PDF export.
13. Cash ledger recording (`cash in` and `cash out`).
14. Audit logs for sensitive actions.
15. Shift opening/closing with expected vs actual cash variance.
16. Auth hardening (login lockout, refresh token rotation, password reset flow).

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run client only:
   ```bash
   npm run dev:client
   ```

3. Run server only:
   ```bash
   npm run dev:server
   ```

4. Run both client and server:
   ```bash
   npm run dev
   ```

5. Configure server auth env:
   `AUTH_JWT_SECRET` is required for login/token verification.

6. Run server tests:
   ```bash
   npm run test:server
   ```

7. Run server backup/recovery checks:
   ```bash
   npm run ops:backup-check --workspace=server
   ```

## Server API Modules (`/api/v1`)

1. `branches`
- `GET /branches`
- `GET /branches/:branchId`
- `POST /branches`

2. `catalog`
- `GET /catalog/products`
- `POST /catalog/products`
- `POST /catalog/products/:productId/variants`
- `PATCH /catalog/branches/:branchId/variants/:variantId/config`
- `PATCH /catalog/branches/:branchId/variants/:variantId/inventory`

3. `access`
- `POST /access/bootstrap/admin` (public; only when there are no accounts yet)
- `POST /access/login` (public)
- `POST /access/refresh` (public; rotates refresh token)
- `POST /access/logout` (public; revokes refresh token)
- `POST /access/password-reset/request` (public)
- `POST /access/password-reset/confirm` (public)
- `GET /access/me` (authenticated)
- `GET /access/roles`
- `GET /access/permissions`
- `GET /access/accounts`
- `POST /access/accounts`
- `PATCH /access/accounts/:accountId/access`
- `PUT /access/accounts/:accountId/branch-role`

4. `pos`
- `POST /pos/receipts`
- `GET /pos/receipts`
- `GET /pos/receipts/:receiptId`
- `PATCH /pos/receipts/:receiptId/void`

5. `cash`
- `POST /cash/movements`
- `GET /cash/movements`
- `PATCH /cash/movements/:movementId/void`

6. `reports`
- `POST /reports/daily/generate`
- `GET /reports/daily`
- `GET /reports/daily/:reportId`
- `PATCH /reports/daily/:reportId/pdf`

7. `shifts`
- `GET /shifts`
- `GET /shifts/current?branch_id=...`
- `POST /shifts/open`
- `POST /shifts/:shiftId/close`
