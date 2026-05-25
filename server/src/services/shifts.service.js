import { HttpError } from "../utils/http-error.js";
import { writeAuditLog } from "./audit.service.js";
import { query, withTransaction } from "./db.service.js";

export async function listShifts(filters) {
  const clauses = [];
  const params = [];

  if (filters.branch_id) {
    params.push(filters.branch_id);
    clauses.push(`s.branch_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    clauses.push(`s.status = $${params.length}`);
  }

  if (filters.from) {
    params.push(filters.from);
    clauses.push(`s.opened_at >= $${params.length}`);
  }

  if (filters.to) {
    params.push(filters.to);
    clauses.push(`s.opened_at < $${params.length}`);
  }

  const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await query(
    `
    select
      s.*,
      trim(concat(opener_user.firstname, ' ', opener_user.lastname)) as opened_by_name,
      trim(concat(closer_user.firstname, ' ', closer_user.lastname)) as closed_by_name
    from public.shifts s
    join public.accounts opener on opener.id = s.opened_by_account_id
    join public.users opener_user on opener_user.id = opener.user_id
    left join public.accounts closer on closer.id = s.closed_by_account_id
    left join public.users closer_user on closer_user.id = closer.user_id
    ${whereClause}
    order by s.opened_at desc
    limit 300
    `,
    params
  );

  return result.rows;
}

export async function getCurrentOpenShift(branchId) {
  const result = await query(
    `
    select
      s.*,
      trim(concat(opener_user.firstname, ' ', opener_user.lastname)) as opened_by_name
    from public.shifts s
    join public.accounts opener on opener.id = s.opened_by_account_id
    join public.users opener_user on opener_user.id = opener.user_id
    where s.branch_id = $1
      and s.status = 'OPEN'
    limit 1
    `,
    [branchId]
  );

  return result.rows[0] ?? null;
}

export async function openShift(payload) {
  return withTransaction(async (client) => {
    const existingOpenResult = await client.query(
      `
      select id
      from public.shifts
      where branch_id = $1
        and status = 'OPEN'
      limit 1
      `,
      [payload.branch_id]
    );

    if (existingOpenResult.rows.length > 0) {
      throw new HttpError(409, "An open shift already exists for this branch.");
    }

    const result = await client.query(
      `
      insert into public.shifts (
        branch_id,
        opened_by_account_id,
        opening_cash,
        status,
        notes
      )
      values ($1, $2, $3, 'OPEN', $4)
      returning *
      `,
      [
        payload.branch_id,
        payload.opened_by_account_id,
        payload.opening_cash,
        payload.notes ?? null
      ]
    );

    const shift = result.rows[0];

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
      values ($1, $2, 'SHIFT_OPENED', 'shift', $3, $4::jsonb)
      `,
      [
        payload.branch_id,
        payload.opened_by_account_id,
        shift.id,
        JSON.stringify({
          opening_cash: Number(shift.opening_cash),
          notes: shift.notes
        })
      ]
    );

    return shift;
  });
}

export async function closeShift(shiftId, payload) {
  return withTransaction(async (client) => {
    const shiftResult = await client.query(
      `
      select *
      from public.shifts
      where id = $1
      for update
      `,
      [shiftId]
    );

    if (shiftResult.rows.length === 0) {
      throw new HttpError(404, "Shift not found.");
    }

    const shift = shiftResult.rows[0];

    if (shift.status !== "OPEN") {
      throw new HttpError(409, "Shift is already closed.");
    }

    const receiptsSummaryResult = await client.query(
      `
      select
        coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0) as net_sales,
        count(*) filter (where status = 'COMPLETED') as completed_receipts
      from public.sales_receipts
      where shift_id = $1
      `,
      [shiftId]
    );

    const cashSummaryResult = await client.query(
      `
      select
        coalesce(sum(amount) filter (where movement_type = 'IN' and status = 'POSTED'), 0) as cash_in_total,
        coalesce(sum(amount) filter (where movement_type = 'OUT' and status = 'POSTED'), 0) as cash_out_total
      from public.cash_movements
      where shift_id = $1
      `,
      [shiftId]
    );

    const netSales = Number(receiptsSummaryResult.rows[0].net_sales);
    const completedReceipts = Number(receiptsSummaryResult.rows[0].completed_receipts);
    const cashInTotal = Number(cashSummaryResult.rows[0].cash_in_total);
    const cashOutTotal = Number(cashSummaryResult.rows[0].cash_out_total);
    const openingCash = Number(shift.opening_cash);
    const closingCashExpected = openingCash + netSales + cashInTotal - cashOutTotal;
    const closingCashActual = Number(payload.closing_cash_actual);
    const cashVariance = closingCashActual - closingCashExpected;

    const updateResult = await client.query(
      `
      update public.shifts
      set
        status = 'CLOSED',
        closed_by_account_id = $2,
        closed_at = now(),
        closing_cash_expected = $3,
        closing_cash_actual = $4,
        cash_variance = $5,
        notes = coalesce($6, notes)
      where id = $1
      returning *
      `,
      [
        shiftId,
        payload.closed_by_account_id,
        closingCashExpected,
        closingCashActual,
        cashVariance,
        payload.notes ?? null
      ]
    );

    const updatedShift = updateResult.rows[0];

    await client.query(
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
      values ($1, $2, 'SHIFT_CLOSED', 'shift', $3, $4::jsonb, $5)
      `,
      [
        updatedShift.branch_id,
        payload.closed_by_account_id,
        updatedShift.id,
        JSON.stringify({
          opening_cash: openingCash,
          net_sales: netSales,
          cash_in_total: cashInTotal,
          cash_out_total: cashOutTotal,
          closing_cash_expected: closingCashExpected,
          closing_cash_actual: closingCashActual,
          cash_variance: cashVariance,
          completed_receipts: completedReceipts
        }),
        payload.notes ?? null
      ]
    );

    return {
      shift: updatedShift,
      summary: {
        opening_cash: openingCash,
        net_sales: netSales,
        cash_in_total: cashInTotal,
        cash_out_total: cashOutTotal,
        closing_cash_expected: closingCashExpected,
        closing_cash_actual: closingCashActual,
        cash_variance: cashVariance,
        completed_receipts: completedReceipts
      }
    };
  });
}

export async function addShiftAuditLog(entry) {
  return writeAuditLog(entry);
}
