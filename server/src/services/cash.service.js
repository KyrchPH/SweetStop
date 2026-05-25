import { HttpError } from "../utils/http-error.js";
import { writeAuditLog } from "./audit.service.js";
import { query } from "./db.service.js";

export async function createCashMovement(payload) {
  const result = await query(
    `
    insert into public.cash_movements (
      branch_id,
      shift_id,
      created_by_account_id,
      movement_type,
      category,
      amount,
      reference_no,
      reason,
      status
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, 'POSTED')
    returning *
    `,
    [
      payload.branch_id,
      payload.shift_id ?? null,
      payload.created_by_account_id,
      payload.movement_type,
      payload.category,
      payload.amount,
      payload.reference_no ?? null,
      payload.reason ?? null
    ]
  );

  const movement = result.rows[0];

  await writeAuditLog({
    branch_id: movement.branch_id,
    account_id: payload.created_by_account_id,
    action: "CASH_MOVEMENT_CREATED",
    entity_type: "cash_movement",
    entity_id: movement.id,
    details: {
      movement_type: movement.movement_type,
      category: movement.category,
      amount: Number(movement.amount),
      shift_id: movement.shift_id
    },
    reason: payload.reason ?? null
  });

  return movement;
}

export async function listCashMovements(filters) {
  const clauses = [];
  const params = [];

  if (filters.branch_id) {
    params.push(filters.branch_id);
    clauses.push(`branch_id = $${params.length}`);
  }

  if (filters.from) {
    params.push(filters.from);
    clauses.push(`created_at >= $${params.length}`);
  }

  if (filters.to) {
    params.push(filters.to);
    clauses.push(`created_at < $${params.length}`);
  }

  const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await query(
    `
    select *
    from public.cash_movements
    ${whereClause}
    order by created_at desc
    limit 500
    `,
    params
  );

  return result.rows;
}

export async function voidCashMovement(movementId, payload) {
  const result = await query(
    `
    update public.cash_movements
    set
      status = 'VOIDED',
      voided_by_account_id = $2,
      voided_at = now(),
      void_reason = $3
    where id = $1
      and status = 'POSTED'
    returning *
    `,
    [movementId, payload.voided_by_account_id, payload.void_reason ?? null]
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, "Cash movement not found or already voided.");
  }

  const movement = result.rows[0];

  await writeAuditLog({
    branch_id: movement.branch_id,
    account_id: payload.voided_by_account_id,
    action: "CASH_MOVEMENT_VOIDED",
    entity_type: "cash_movement",
    entity_id: movement.id,
    details: {
      movement_type: movement.movement_type,
      category: movement.category,
      amount: Number(movement.amount)
    },
    reason: payload.void_reason ?? null
  });

  return movement;
}
