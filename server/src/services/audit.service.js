import { query } from "./db.service.js";

export async function writeAuditLog({
  branch_id = null,
  account_id = null,
  action,
  entity_type,
  entity_id,
  details = {},
  reason = null
}) {
  if (!action || !entity_type || !entity_id) {
    return null;
  }

  const normalizedDetails =
    details && typeof details === "object" && !Array.isArray(details) ? details : {};

  const result = await query(
    `
    insert into public.audit_logs (
      branch_id,
      account_id,
      action,
      entity_type,
      entity_id,
      details,
      reason
    )
    values ($1, $2, $3, $4, $5, $6::jsonb, $7)
    returning *
    `,
    [
      branch_id,
      account_id,
      action,
      entity_type,
      String(entity_id),
      JSON.stringify(normalizedDetails),
      reason
    ]
  );

  return result.rows[0];
}
