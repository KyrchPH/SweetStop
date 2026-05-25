import * as shiftsService from "../services/shifts.service.js";
import {
  assertUuid,
  parseIsoDate,
  parseNonNegativeNumber
} from "../utils/validators.js";

export async function listShifts(req, res) {
  const { branch_id, status, from, to } = req.query;

  if (branch_id) {
    assertUuid(branch_id, "branch_id");
  }

  const normalizedStatus =
    typeof status === "string" && status.trim() !== ""
      ? status.trim().toUpperCase()
      : undefined;

  const data = await shiftsService.listShifts({
    branch_id,
    status: normalizedStatus,
    from: from ? parseIsoDate(from, "from") : undefined,
    to: to ? parseIsoDate(to, "to") : undefined
  });

  res.status(200).json({ ok: true, data });
}

export async function getCurrentOpenShift(req, res) {
  const { branch_id } = req.query;
  assertUuid(branch_id, "branch_id");

  const data = await shiftsService.getCurrentOpenShift(branch_id);
  res.status(200).json({ ok: true, data });
}

export async function openShift(req, res) {
  const { branch_id, opening_cash, notes } = req.body ?? {};
  assertUuid(branch_id, "branch_id");

  const data = await shiftsService.openShift({
    branch_id,
    opening_cash: parseNonNegativeNumber(opening_cash, "opening_cash"),
    notes,
    opened_by_account_id: req.auth.account_id
  });

  res.status(201).json({ ok: true, data });
}

export async function closeShift(req, res) {
  const { shiftId } = req.params;
  const { closing_cash_actual, notes } = req.body ?? {};
  assertUuid(shiftId, "shiftId");

  const data = await shiftsService.closeShift(shiftId, {
    closing_cash_actual: parseNonNegativeNumber(closing_cash_actual, "closing_cash_actual"),
    notes,
    closed_by_account_id: req.auth.account_id
  });

  res.status(200).json({ ok: true, data });
}
