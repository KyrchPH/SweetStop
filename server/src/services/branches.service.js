import { HttpError } from "../utils/http-error.js";
import { writeAuditLog } from "./audit.service.js";
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

export async function updateBranch(branchId, payload) {
  const currentResult = await query(
    `
    select id, name, address, timezone, status
    from public.branches
    where id = $1
    `,
    [branchId]
  );

  if (currentResult.rows.length === 0) {
    throw new HttpError(404, "Branch not found.");
  }

  const current = currentResult.rows[0];
  const result = await query(
    `
    update public.branches
    set
      name = $2,
      address = $3,
      timezone = $4,
      status = $5
    where id = $1
    returning id, name, address, timezone, status, created_at, updated_at
    `,
    [
      branchId,
      payload.name ?? current.name,
      payload.address === undefined ? current.address : payload.address,
      payload.timezone ?? current.timezone,
      payload.status ?? current.status
    ]
  );

  const branch = result.rows[0];

  if (payload.actor_account_id) {
    await writeAuditLog({
      branch_id: branch.id,
      account_id: payload.actor_account_id,
      action: "BRANCH_UPDATED",
      entity_type: "branch",
      entity_id: branch.id,
      details: {
        name: branch.name,
        status: branch.status
      }
    });
  }

  return branch;
}
