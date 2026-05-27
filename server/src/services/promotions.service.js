import { HttpError } from "../utils/http-error.js";
import { writeAuditLog } from "./audit.service.js";
import { query } from "./db.service.js";

function normalizePromotionRow(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    discount_value: Number(row.discount_value),
    min_subtotal: Number(row.min_subtotal)
  };
}

function normalizeCode(code) {
  if (typeof code !== "string" || code.trim() === "") {
    return null;
  }

  return code.trim().toUpperCase();
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function assertPromotionIsCurrent(promotion, subtotal) {
  const now = Date.now();
  const startsAt = promotion.starts_at ? new Date(promotion.starts_at).getTime() : null;
  const endsAt = promotion.ends_at ? new Date(promotion.ends_at).getTime() : null;

  if (promotion.status !== "ACTIVE") {
    throw new HttpError(400, "Selected promotion is inactive.");
  }

  if (startsAt !== null && now < startsAt) {
    throw new HttpError(400, "Selected promotion has not started yet.");
  }

  if (endsAt !== null && now >= endsAt) {
    throw new HttpError(400, "Selected promotion has already ended.");
  }

  if (Number(promotion.min_subtotal) > subtotal) {
    throw new HttpError(400, "Receipt subtotal does not meet the promotion minimum.");
  }
}

export function calculatePromotionDiscount(promotion, subtotal) {
  const value = Number(promotion.discount_value);

  if (promotion.discount_type === "PERCENT") {
    return Math.min(subtotal, roundCurrency(subtotal * (value / 100)));
  }

  return Math.min(subtotal, roundCurrency(value));
}

export async function listPromotions(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.branch_id) {
    params.push(filters.branch_id);
    clauses.push(`branch_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }

  if (filters.current_only) {
    clauses.push(`status = 'ACTIVE'`);
    clauses.push(`(starts_at is null or starts_at <= now())`);
    clauses.push(`(ends_at is null or ends_at > now())`);
  }

  const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await query(
    `
    select
      *,
      (
        status = 'ACTIVE'
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now())
      ) as is_current
    from public.promotions
    ${whereClause}
    order by status asc, starts_at nulls first, name asc
    limit 500
    `,
    params
  );

  return result.rows.map(normalizePromotionRow);
}

export async function createPromotion(payload) {
  const result = await query(
    `
    insert into public.promotions (
      branch_id,
      name,
      code,
      description,
      discount_type,
      discount_value,
      min_subtotal,
      starts_at,
      ends_at,
      status
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    returning *
    `,
    [
      payload.branch_id,
      payload.name,
      normalizeCode(payload.code),
      payload.description ?? null,
      payload.discount_type,
      payload.discount_value,
      payload.min_subtotal ?? 0,
      payload.starts_at ?? null,
      payload.ends_at ?? null,
      payload.status ?? "ACTIVE"
    ]
  );

  const promotion = normalizePromotionRow(result.rows[0]);

  await writeAuditLog({
    branch_id: promotion.branch_id,
    account_id: payload.actor_account_id,
    action: "PROMOTION_CREATED",
    entity_type: "promotion",
    entity_id: promotion.id,
    details: {
      name: promotion.name,
      code: promotion.code,
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value
    }
  });

  return promotion;
}

export async function updatePromotion(promotionId, payload) {
  const currentResult = await query(
    `
    select *
    from public.promotions
    where id = $1
    `,
    [promotionId]
  );

  if (currentResult.rows.length === 0) {
    throw new HttpError(404, "Promotion not found.");
  }

  const current = currentResult.rows[0];
  const result = await query(
    `
    update public.promotions
    set
      name = $2,
      code = $3,
      description = $4,
      discount_type = $5,
      discount_value = $6,
      min_subtotal = $7,
      starts_at = $8,
      ends_at = $9,
      status = $10
    where id = $1
    returning *
    `,
    [
      promotionId,
      payload.name ?? current.name,
      payload.code === undefined ? current.code : normalizeCode(payload.code),
      payload.description === undefined ? current.description : payload.description,
      payload.discount_type ?? current.discount_type,
      payload.discount_value ?? Number(current.discount_value),
      payload.min_subtotal ?? Number(current.min_subtotal),
      payload.starts_at === undefined ? current.starts_at : payload.starts_at,
      payload.ends_at === undefined ? current.ends_at : payload.ends_at,
      payload.status ?? current.status
    ]
  );

  const promotion = normalizePromotionRow(result.rows[0]);

  await writeAuditLog({
    branch_id: promotion.branch_id,
    account_id: payload.actor_account_id,
    action: "PROMOTION_UPDATED",
    entity_type: "promotion",
    entity_id: promotion.id,
    details: {
      name: promotion.name,
      code: promotion.code,
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      status: promotion.status
    }
  });

  return promotion;
}

export async function resolveReceiptPromotion(client, payload) {
  if (!payload.promotion_id) {
    return null;
  }

  const result = await client.query(
    `
    select *
    from public.promotions
    where id = $1
      and branch_id = $2
    `,
    [payload.promotion_id, payload.branch_id]
  );

  if (result.rows.length === 0) {
    throw new HttpError(400, "Promotion is not available for this branch.");
  }

  const promotion = normalizePromotionRow(result.rows[0]);
  assertPromotionIsCurrent(promotion, payload.subtotal);

  return {
    promotion,
    discount_total: calculatePromotionDiscount(promotion, payload.subtotal),
    discount_label: promotion.code ? `${promotion.name} (${promotion.code})` : promotion.name
  };
}
