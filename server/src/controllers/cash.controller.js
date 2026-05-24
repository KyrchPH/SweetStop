import * as cashService from "../services/cash.service.js";
import { HttpError } from "../utils/http-error.js";
import {
  assertNonEmptyString,
  assertUuid,
  parseIsoDate,
  parsePositiveNumber
} from "../utils/validators.js";

export async function createCashMovement(req, res) {
  const {
    branch_id,
    shift_id,
    created_by_account_id,
    movement_type,
    category,
    amount,
    reference_no,
    reason
  } = req.body ?? {};

  assertUuid(branch_id, "branch_id");
  assertUuid(created_by_account_id, "created_by_account_id");
  assertNonEmptyString(movement_type, "movement_type");
  assertNonEmptyString(category, "category");

  if (shift_id) {
    assertUuid(shift_id, "shift_id");
  }

  const normalizedMovementType = movement_type.trim().toUpperCase();

  if (normalizedMovementType !== "IN" && normalizedMovementType !== "OUT") {
    throw new HttpError(400, "movement_type must be either IN or OUT.");
  }

  const data = await cashService.createCashMovement({
    branch_id,
    shift_id,
    created_by_account_id,
    movement_type: normalizedMovementType,
    category: category.trim(),
    amount: parsePositiveNumber(amount, "amount"),
    reference_no,
    reason
  });

  res.status(201).json({ ok: true, data });
}

export async function listCashMovements(req, res) {
  const { branch_id, from, to } = req.query;

  if (branch_id) {
    assertUuid(branch_id, "branch_id");
  }

  const data = await cashService.listCashMovements({
    branch_id,
    from: from ? parseIsoDate(from, "from") : undefined,
    to: to ? parseIsoDate(to, "to") : undefined
  });

  res.status(200).json({ ok: true, data });
}

export async function voidCashMovement(req, res) {
  const { movementId } = req.params;
  const { voided_by_account_id, void_reason } = req.body ?? {};

  assertUuid(movementId, "movementId");
  assertUuid(voided_by_account_id, "voided_by_account_id");

  const data = await cashService.voidCashMovement(movementId, {
    voided_by_account_id,
    void_reason
  });

  res.status(200).json({ ok: true, data });
}
