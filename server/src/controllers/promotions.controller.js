import * as promotionsService from "../services/promotions.service.js";
import { HttpError } from "../utils/http-error.js";
import {
  assertNonEmptyString,
  assertUuid,
  parseIsoDate,
  parseNonNegativeNumber,
  parsePositiveNumber
} from "../utils/validators.js";

const DISCOUNT_TYPES = new Set(["PERCENT", "FIXED"]);
const PROMOTION_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

function assertDiscountType(value) {
  if (!DISCOUNT_TYPES.has(value)) {
    throw new HttpError(400, "discount_type must be PERCENT or FIXED.");
  }
}

function assertStatus(value) {
  if (!PROMOTION_STATUSES.has(value)) {
    throw new HttpError(400, "status must be ACTIVE or INACTIVE.");
  }
}

function parseOptionalIsoDate(value, fieldName) {
  return value === undefined ? undefined : parseIsoDate(value, fieldName);
}

function assertValidWindow(startsAt, endsAt) {
  if (!startsAt || !endsAt) {
    return;
  }

  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new HttpError(400, "ends_at must be after starts_at.");
  }
}

export async function listPromotions(req, res) {
  const { branch_id, status, current_only } = req.query;

  if (branch_id) {
    assertUuid(branch_id, "branch_id");
  }

  if (status) {
    assertStatus(status);
  }

  const data = await promotionsService.listPromotions({
    branch_id,
    status,
    current_only: current_only === "true"
  });

  res.status(200).json({ ok: true, data });
}

export async function createPromotion(req, res) {
  const {
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
  } = req.body ?? {};

  assertUuid(branch_id, "branch_id");
  assertNonEmptyString(name, "name");
  assertDiscountType(discount_type);

  if (status !== undefined) {
    assertStatus(status);
  }

  const startsAt = parseOptionalIsoDate(starts_at, "starts_at");
  const endsAt = parseOptionalIsoDate(ends_at, "ends_at");
  assertValidWindow(startsAt, endsAt);

  const data = await promotionsService.createPromotion({
    branch_id,
    name: name.trim(),
    code,
    description,
    discount_type,
    discount_value: parsePositiveNumber(discount_value, "discount_value"),
    min_subtotal:
      min_subtotal === undefined ? 0 : parseNonNegativeNumber(min_subtotal, "min_subtotal"),
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    actor_account_id: req.auth.account_id
  });

  res.status(201).json({ ok: true, data });
}

export async function updatePromotion(req, res) {
  const { promotionId } = req.params;
  const {
    name,
    code,
    description,
    discount_type,
    discount_value,
    min_subtotal,
    starts_at,
    ends_at,
    status
  } = req.body ?? {};

  assertUuid(promotionId, "promotionId");

  if (name !== undefined) {
    assertNonEmptyString(name, "name");
  }

  if (discount_type !== undefined) {
    assertDiscountType(discount_type);
  }

  if (status !== undefined) {
    assertStatus(status);
  }

  const startsAt = parseOptionalIsoDate(starts_at, "starts_at");
  const endsAt = parseOptionalIsoDate(ends_at, "ends_at");
  assertValidWindow(startsAt, endsAt);

  const data = await promotionsService.updatePromotion(promotionId, {
    name: name?.trim(),
    code,
    description,
    discount_type,
    discount_value:
      discount_value === undefined
        ? undefined
        : parsePositiveNumber(discount_value, "discount_value"),
    min_subtotal:
      min_subtotal === undefined ? undefined : parseNonNegativeNumber(min_subtotal, "min_subtotal"),
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    actor_account_id: req.auth.account_id
  });

  res.status(200).json({ ok: true, data });
}
