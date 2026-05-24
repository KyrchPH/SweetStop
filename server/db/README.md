# SweetStop Database Setup

## Files

- `sql/001_schema.sql`: full schema (tables, constraints, indexes, triggers, view)
- `sql/002_seed.sql`: base roles, permissions, and role-permission mappings

## Run Setup

1. Create `server/.env` from `server/.env.example`.
2. Set `DATABASE_URL` (or `SUPABASE_DB_URL`) to your Postgres/Supabase connection string.
3. Run:

```bash
npm run db:setup --workspace=server
```

## Optional Commands

```bash
npm run db:schema --workspace=server
npm run db:seed --workspace=server
```
