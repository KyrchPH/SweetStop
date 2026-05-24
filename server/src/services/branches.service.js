import { query } from "./db.service.js";

export async function listBranches() {
  const result = await query(
    `
    select id, name, address, timezone, status, created_at, updated_at
    from public.branches
    order by name asc
    `
  );

  return result.rows;
}

export async function getBranchById(branchId) {
  const result = await query(
    `
    select id, name, address, timezone, status, created_at, updated_at
    from public.branches
    where id = $1
    `,
    [branchId]
  );

  return result.rows[0] ?? null;
}

export async function createBranch({ name, address, timezone, status }) {
  const result = await query(
    `
    insert into public.branches (name, address, timezone, status)
    values ($1, $2, $3, $4)
    returning id, name, address, timezone, status, created_at, updated_at
    `,
    [name, address ?? null, timezone ?? "Asia/Manila", status ?? "ACTIVE"]
  );

  return result.rows[0];
}
