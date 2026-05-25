import { HttpError } from "../utils/http-error.js";
import { writeAuditLog } from "./audit.service.js";
import { query, withTransaction } from "./db.service.js";

const DEFAULT_REPORT_PDF_ALLOWED_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com"
];

function getAllowedReportPdfHosts() {
  const fromEnv = process.env.REPORT_PDF_ALLOWED_HOSTS;

  if (!fromEnv || fromEnv.trim() === "") {
    return DEFAULT_REPORT_PDF_ALLOWED_HOSTS;
  }

  const hosts = fromEnv
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== "");

  return hosts.length > 0 ? hosts : DEFAULT_REPORT_PDF_ALLOWED_HOSTS;
}

function validateAndNormalizeReportPdfUrl(pdfUrl) {
  if (typeof pdfUrl !== "string" || pdfUrl.trim() === "") {
    throw new HttpError(400, "pdf_url is required.");
  }

  let parsed;

  try {
    parsed = new URL(pdfUrl.trim());
  } catch {
    throw new HttpError(400, "pdf_url must be a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new HttpError(400, "pdf_url must use HTTPS.");
  }

  const host = parsed.hostname.toLowerCase();
  const allowedHosts = getAllowedReportPdfHosts();
  const hostAllowed = allowedHosts.some(
    (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`)
  );

  if (!hostAllowed) {
    throw new HttpError(
      400,
      `pdf_url host is not allowed. Allowed hosts: ${allowedHosts.join(", ")}`
    );
  }

  const decodedPath = decodeURIComponent(parsed.pathname || "");
  const pathPattern =
    process.env.REPORT_PDF_PATH_REGEX || "^/.*/reports/.+\\.pdf$";
  let pathRegex;

  try {
    pathRegex = new RegExp(pathPattern, "i");
  } catch {
    throw new HttpError(500, "REPORT_PDF_PATH_REGEX is invalid.");
  }

  if (!pathRegex.test(decodedPath)) {
    throw new HttpError(
      400,
      "pdf_url path does not match allowed report PDF path pattern."
    );
  }

  if (!decodedPath.toLowerCase().endsWith(".pdf")) {
    throw new HttpError(400, "pdf_url must point to a .pdf file.");
  }

  return parsed.toString();
}

async function resolveBranchTimezone(client, branchId, fallbackTimezone) {
  if (fallbackTimezone) {
    return fallbackTimezone;
  }

  const branchResult = await client.query(
    `
    select timezone
    from public.branches
    where id = $1
    `,
    [branchId]
  );

  if (branchResult.rows.length === 0) {
    throw new HttpError(404, "Branch not found.");
  }

  return branchResult.rows[0].timezone || "Asia/Manila";
}

async function resolvePeriod(client, businessDate, timezone) {
  const periodResult = await client.query(
    `
    select
      ($1::date::timestamp at time zone $2) as period_start_at,
      (($1::date + interval '1 day')::timestamp at time zone $2) as period_end_at
    `,
    [businessDate, timezone]
  );

  return periodResult.rows[0];
}

export async function generateDailyReport(payload) {
  return withTransaction(async (client) => {
    const timezone = await resolveBranchTimezone(client, payload.branch_id, payload.timezone);
    const period = await resolvePeriod(client, payload.business_date, timezone);
    const periodStartAt = period.period_start_at;
    const periodEndAt = period.period_end_at;

    const receiptSummaryResult = await client.query(
      `
      select
        count(*) filter (where status = 'COMPLETED') as receipts_count,
        count(*) filter (where status = 'VOIDED') as voided_count,
        coalesce(sum(subtotal) filter (where status = 'COMPLETED'), 0) as gross_sales,
        coalesce(sum(discount_total) filter (where status = 'COMPLETED'), 0) as discount_total,
        coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0) as net_sales
      from public.sales_receipts
      where branch_id = $1
        and sold_at >= $2
        and sold_at < $3
      `,
      [payload.branch_id, periodStartAt, periodEndAt]
    );

    const itemsSummaryResult = await client.query(
      `
      select
        coalesce(sum(i.quantity), 0) as items_sold_qty
      from public.sales_receipt_items i
      join public.sales_receipts r on r.id = i.receipt_id
      where r.branch_id = $1
        and r.status = 'COMPLETED'
        and r.sold_at >= $2
        and r.sold_at < $3
      `,
      [payload.branch_id, periodStartAt, periodEndAt]
    );

    const cashSummaryResult = await client.query(
      `
      select
        coalesce(sum(amount) filter (where movement_type = 'IN' and status = 'POSTED'), 0) as cash_in_total,
        coalesce(sum(amount) filter (where movement_type = 'OUT' and status = 'POSTED'), 0) as cash_out_total
      from public.cash_movements
      where branch_id = $1
        and created_at >= $2
        and created_at < $3
      `,
      [payload.branch_id, periodStartAt, periodEndAt]
    );

    const openingCashResult = await client.query(
      `
      select
        coalesce(sum(opening_cash), 0) as opening_cash_total
      from public.shifts
      where branch_id = $1
        and opened_at >= $2
        and opened_at < $3
      `,
      [payload.branch_id, periodStartAt, periodEndAt]
    );

    const receipts = receiptSummaryResult.rows[0];
    const items = itemsSummaryResult.rows[0];
    const cash = cashSummaryResult.rows[0];
    const openingCash = Number(openingCashResult.rows[0].opening_cash_total);

    const grossSales = Number(receipts.gross_sales);
    const discountTotal = Number(receipts.discount_total);
    const netSales = Number(receipts.net_sales);
    const cashInTotal = Number(cash.cash_in_total);
    const cashOutTotal = Number(cash.cash_out_total);
    const expectedCashEnd = openingCash + netSales + cashInTotal - cashOutTotal;
    const actualCashEnd =
      payload.actual_cash_end === undefined || payload.actual_cash_end === null
        ? null
        : Number(payload.actual_cash_end);
    const cashVariance = actualCashEnd === null ? null : actualCashEnd - expectedCashEnd;

    const upsertResult = await client.query(
      `
      insert into public.daily_reports (
        branch_id,
        business_date,
        timezone,
        period_start_at,
        period_end_at,
        generated_by_account_id,
        generated_at,
        status,
        receipts_count,
        voided_count,
        items_sold_qty,
        gross_sales,
        discount_total,
        net_sales,
        cash_in_total,
        cash_out_total,
        expected_cash_end,
        actual_cash_end,
        cash_variance,
        pdf_url,
        error_message
      )
      values (
        $1, $2, $3, $4, $5, $6, now(), 'READY',
        $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, null
      )
      on conflict (branch_id, business_date)
      do update set
        timezone = excluded.timezone,
        period_start_at = excluded.period_start_at,
        period_end_at = excluded.period_end_at,
        generated_by_account_id = excluded.generated_by_account_id,
        generated_at = excluded.generated_at,
        status = excluded.status,
        receipts_count = excluded.receipts_count,
        voided_count = excluded.voided_count,
        items_sold_qty = excluded.items_sold_qty,
        gross_sales = excluded.gross_sales,
        discount_total = excluded.discount_total,
        net_sales = excluded.net_sales,
        cash_in_total = excluded.cash_in_total,
        cash_out_total = excluded.cash_out_total,
        expected_cash_end = excluded.expected_cash_end,
        actual_cash_end = excluded.actual_cash_end,
        cash_variance = excluded.cash_variance,
        pdf_url = excluded.pdf_url,
        error_message = excluded.error_message,
        updated_at = now()
      returning *
      `,
      [
        payload.branch_id,
        payload.business_date,
        timezone,
        periodStartAt,
        periodEndAt,
        payload.generated_by_account_id,
        Number(receipts.receipts_count),
        Number(receipts.voided_count),
        Number(items.items_sold_qty),
        grossSales,
        discountTotal,
        netSales,
        cashInTotal,
        cashOutTotal,
        expectedCashEnd,
        actualCashEnd,
        cashVariance,
        payload.pdf_url ?? null
      ]
    );

    const report = upsertResult.rows[0];

    await client.query(
      `
      delete from public.daily_report_product_sales
      where report_id = $1
      `,
      [report.id]
    );

    await client.query(
      `
      insert into public.daily_report_product_sales (
        report_id,
        variant_id,
        product_name_snapshot,
        variant_name_snapshot,
        qty_sold,
        sales_amount
      )
      select
        $1 as report_id,
        i.variant_id,
        max(i.product_name_snapshot) as product_name_snapshot,
        max(i.variant_name_snapshot) as variant_name_snapshot,
        coalesce(sum(i.quantity), 0) as qty_sold,
        coalesce(sum(i.line_total), 0) as sales_amount
      from public.sales_receipt_items i
      join public.sales_receipts r on r.id = i.receipt_id
      where r.branch_id = $2
        and r.status = 'COMPLETED'
        and r.sold_at >= $3
        and r.sold_at < $4
      group by i.variant_id
      `,
      [report.id, payload.branch_id, periodStartAt, periodEndAt]
    );

    await client.query(
      `
      delete from public.daily_report_cashier_sales
      where report_id = $1
      `,
      [report.id]
    );

    await client.query(
      `
      insert into public.daily_report_cashier_sales (
        report_id,
        account_id,
        cashier_name,
        receipts_count,
        sales_amount
      )
      select
        $1 as report_id,
        r.cashier_account_id as account_id,
        trim(concat(u.firstname, ' ', u.lastname)) as cashier_name,
        count(*) as receipts_count,
        coalesce(sum(r.total_amount), 0) as sales_amount
      from public.sales_receipts r
      join public.accounts a on a.id = r.cashier_account_id
      join public.users u on u.id = a.user_id
      where r.branch_id = $2
        and r.status = 'COMPLETED'
        and r.sold_at >= $3
        and r.sold_at < $4
      group by r.cashier_account_id, u.firstname, u.lastname
      `,
      [report.id, payload.branch_id, periodStartAt, periodEndAt]
    );

    await client.query(
      `
      insert into public.audit_logs (
        branch_id,
        account_id,
        action,
        entity_type,
        entity_id,
        details
      )
      values ($1, $2, 'DAILY_REPORT_GENERATED', 'daily_report', $3, $4::jsonb)
      `,
      [
        report.branch_id,
        payload.generated_by_account_id,
        report.id,
        JSON.stringify({
          business_date: report.business_date,
          net_sales: Number(report.net_sales),
          expected_cash_end: Number(report.expected_cash_end),
          actual_cash_end:
            report.actual_cash_end === null ? null : Number(report.actual_cash_end)
        })
      ]
    );

    return report;
  });
}

export async function listDailyReports(filters) {
  const clauses = [];
  const params = [];

  if (filters.branch_id) {
    params.push(filters.branch_id);
    clauses.push(`branch_id = $${params.length}`);
  }

  if (filters.from_date) {
    params.push(filters.from_date);
    clauses.push(`business_date >= $${params.length}`);
  }

  if (filters.to_date) {
    params.push(filters.to_date);
    clauses.push(`business_date <= $${params.length}`);
  }

  const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await query(
    `
    select *
    from public.daily_reports
    ${whereClause}
    order by business_date desc
    limit 180
    `,
    params
  );

  return result.rows;
}

export async function getDailyReportById(reportId) {
  const reportResult = await query(
    `
    select *
    from public.daily_reports
    where id = $1
    `,
    [reportId]
  );

  if (reportResult.rows.length === 0) {
    throw new HttpError(404, "Daily report not found.");
  }

  const productSalesResult = await query(
    `
    select *
    from public.daily_report_product_sales
    where report_id = $1
    order by sales_amount desc
    `,
    [reportId]
  );

  const cashierSalesResult = await query(
    `
    select *
    from public.daily_report_cashier_sales
    where report_id = $1
    order by sales_amount desc
    `,
    [reportId]
  );

  return {
    report: reportResult.rows[0],
    product_sales: productSalesResult.rows,
    cashier_sales: cashierSalesResult.rows
  };
}

export async function updateDailyReportPdf(reportId, payload) {
  const normalizedPdfUrl = validateAndNormalizeReportPdfUrl(payload.pdf_url);

  const result = await query(
    `
    update public.daily_reports
    set
      pdf_url = $2,
      status = case when status = 'FAILED' then 'READY' else status end,
      error_message = null,
      updated_at = now()
    where id = $1
    returning *
    `,
    [reportId, normalizedPdfUrl]
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, "Daily report not found.");
  }

  const report = result.rows[0];

  await writeAuditLog({
    branch_id: report.branch_id,
    account_id: payload.actor_account_id ?? null,
    action: "DAILY_REPORT_PDF_UPDATED",
    entity_type: "daily_report",
    entity_id: report.id,
    details: {
      business_date: report.business_date,
      pdf_url: report.pdf_url
    }
  });

  return report;
}
