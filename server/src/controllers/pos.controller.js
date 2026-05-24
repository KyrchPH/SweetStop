import * as posService from "../services/pos.service.js";
import {
  assertUuid,
  parseIsoDate,
  parseNonNegativeNumber
} from "../utils/validators.js";

export async function createReceipt(req, res) {
  const {
    branch_id,
    shift_id,
    cashier_account_id,
    discount_total,
    cash_received,
    items
  } = req.body ?? {};

  assertUuid(branch_id, "branch_id");
  assertUuid(cashier_account_id, "cashier_account_id");

  if (shift_id) {
    assertUuid(shift_id, "shift_id");
  }

  const data = await posService.createReceipt({
    branch_id,
    shift_id,
    cashier_account_id,
    discount_total: discount_total === undefined ? 0 : parseNonNegativeNumber(discount_total, "discount_total"),
    cash_received: parseNonNegativeNumber(cash_received, "cash_received"),
    items
  });

  res.status(201).json({ ok: true, data });
}

export async function listReceipts(req, res) {
  const { branch_id, from, to } = req.query;

  if (branch_id) {
    assertUuid(branch_id, "branch_id");
  }

  const data = await posService.listReceipts({
    branch_id,
    from: from ? parseIsoDate(from, "from") : undefined,
    to: to ? parseIsoDate(to, "to") : undefined
  });

  res.status(200).json({ ok: true, data });
}

export async function getReceiptById(req, res) {
  const { receiptId } = req.params;
  assertUuid(receiptId, "receiptId");

  const data = await posService.getReceiptById(receiptId);
  res.status(200).json({ ok: true, data });
}

export async function voidReceipt(req, res) {
  const { receiptId } = req.params;
  const { voided_by_account_id, void_reason } = req.body ?? {};

  assertUuid(receiptId, "receiptId");
  assertUuid(voided_by_account_id, "voided_by_account_id");

  const data = await posService.voidReceipt(receiptId, {
    voided_by_account_id,
    void_reason
  });

  res.status(200).json({ ok: true, data });
}
