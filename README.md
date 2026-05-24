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
