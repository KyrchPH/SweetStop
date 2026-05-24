import * as reportsService from "../services/reports.service.js";
import {
  assertUuid,
  parseDateOnly,
  parseNonNegativeNumber
} from "../utils/validators.js";

export async function generateDailyReport(req, res) {
  const {
    branch_id,
    business_date,
    timezone,
    generated_by_account_id,
    actual_cash_end,
    pdf_url
  } = req.body ?? {};

  assertUuid(branch_id, "branch_id");
  assertUuid(generated_by_account_id, "generated_by_account_id");

  const data = await reportsService.generateDailyReport({
    branch_id,
    business_date: parseDateOnly(business_date, "business_date"),
    timezone,
    generated_by_account_id,
    actual_cash_end:
      actual_cash_end === undefined ? undefined : parseNonNegativeNumber(actual_cash_end, "actual_cash_end"),
    pdf_url
  });

  res.status(200).json({ ok: true, data });
}

export async function listDailyReports(req, res) {
  const { branch_id, from_date, to_date } = req.query;

  if (branch_id) {
    assertUuid(branch_id, "branch_id");
  }

  const data = await reportsService.listDailyReports({
    branch_id,
    from_date: from_date ? parseDateOnly(from_date, "from_date") : undefined,
    to_date: to_date ? parseDateOnly(to_date, "to_date") : undefined
  });

  res.status(200).json({ ok: true, data });
}

export async function getDailyReportById(req, res) {
  const { reportId } = req.params;
  assertUuid(reportId, "reportId");

  const data = await reportsService.getDailyReportById(reportId);
  res.status(200).json({ ok: true, data });
}
