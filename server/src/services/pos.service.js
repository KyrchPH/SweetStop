import { HttpError } from "../utils/http-error.js";
import { query, withTransaction } from "./db.service.js";

function isUnavailable(configRow) {
  if (!configRow.manual_unavailable) {
    return false;
  }

  const now = Date.now();
  const from = configRow.unavailable_from
    ? new Date(configRow.unavailable_from).getTime()
    : Number.NEGATIVE_INFINITY;
  const to = configRow.unavailable_to
    ? new Date(configRow.unavailable_to).getTime()
    : Number.POSITIVE_INFINITY;

  return now >= from && now < to;
}

function normalizeReceiptItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "items is required and must not be empty.");
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new HttpError(400, `items[${index}] must be an object.`);
    }

    const variantId = item.variant_id;
    const quantity = Number(item.quantity);

    if (typeof variantId !== "string") {
      throw new HttpError(400, `items[${index}].variant_id is required.`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new HttpError(400, `items[${index}].quantity must be a positive number.`);
    }

    return {
      variant_id: variantId,
      quantity
    };
  });
}

function makeReceiptNumber() {
  const now = new Date();
  const datePart = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `RCP-${datePart}-${randomPart}`;
}

export async function createReceipt(payload) {
  const items = normalizeReceiptItems(payload.items);
  const variantIds = [...new Set(items.map((item) => item.variant_id))];
  const discountTotal = Number(payload.discount_total ?? 0);
  const cashReceived = Number(payload.cash_received);

  if (!Number.isFinite(discountTotal) || discountTotal < 0) {
    throw new HttpError(400, "discount_total must be a non-negative number.");
  }

  if (!Number.isFinite(cashReceived) || cashReceived < 0) {
    throw new HttpError(400, "cash_received must be a non-negative number.");
  }

  return withTransaction(async (client) => {
    const configResult = await client.query(
      `
      select
        c.variant_id,
        c.price,
        c.is_applicable,
        c.is_hidden,
        c.manual_unavailable,
        c.unavailable_from,
        c.unavailable_to,
        coalesce(i.on_hand_qty, 0) as on_hand_qty,
        p.name as product_name,
        v.name as variant_name
      from public.branch_variant_config c
      join public.product_variants v on v.id = c.variant_id
      join public.products p on p.id = v.product_id
      left join public.branch_variant_inventory i
        on i.branch_id = c.branch_id
        and i.variant_id = c.variant_id
      where c.branch_id = $1
        and c.variant_id = any($2::uuid[])
      `,
      [payload.branch_id, variantIds]
    );

    if (configResult.rows.length !== variantIds.length) {
      throw new HttpError(400, "One or more variants are not configured for this branch.");
    }

    const configByVariantId = new Map(
      configResult.rows.map((row) => [row.variant_id, row])
    );

    let subtotal = 0;
    const lineItems = [];

    for (const item of items) {
      const config = configByVariantId.get(item.variant_id);

      if (!config) {
        throw new HttpError(400, `Variant not found for branch: ${item.variant_id}`);
      }

      if (config.is_applicable === false || config.is_hidden === true || isUnavailable(config)) {
        throw new HttpError(400, `Variant ${config.variant_name} is currently unavailable.`);
      }

      if (Number(config.on_hand_qty) < item.quantity) {
        throw new HttpError(400, `Insufficient stock for variant ${config.variant_name}.`);
      }

      const unitPrice = Number(config.price);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      lineItems.push({
        variant_id: item.variant_id,
        product_name_snapshot: config.product_name,
        variant_name_snapshot: config.variant_name,
        quantity: item.quantity,
        unit_price: unitPrice,
        line_total: lineTotal
      });
    }

    if (discountTotal > subtotal) {
      throw new HttpError(400, "discount_total cannot exceed subtotal.");
    }

    const totalAmount = subtotal - discountTotal;

    if (cashReceived < totalAmount) {
      throw new HttpError(400, "cash_received must be greater than or equal to total_amount.");
    }

    const changeAmount = cashReceived - totalAmount;
    const receiptNo = makeReceiptNumber();

    const receiptResult = await client.query(
      `
      insert into public.sales_receipts (
        branch_id,
        shift_id,
        receipt_no,
        cashier_account_id,
        subtotal,
        discount_total,
        total_amount,
        cash_received,
        change_amount,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'COMPLETED')
      returning *
      `,
      [
        payload.branch_id,
        payload.shift_id ?? null,
        receiptNo,
        payload.cashier_account_id,
        subtotal,
        discountTotal,
        totalAmount,
        cashReceived,
        changeAmount
      ]
    );

    const receipt = receiptResult.rows[0];

    for (const item of lineItems) {
      await client.query(
        `
        insert into public.sales_receipt_items (
          receipt_id,
          variant_id,
          product_name_snapshot,
          variant_name_snapshot,
          unit_price,
          quantity,
          discount_amount,
          line_total
        )
        values ($1, $2, $3, $4, $5, $6, 0, $7)
        `,
        [
          receipt.id,
          item.variant_id,
          item.product_name_snapshot,
          item.variant_name_snapshot,
          item.unit_price,
          item.quantity,
          item.line_total
        ]
      );

      const updateInventoryResult = await client.query(
        `
        update public.branch_variant_inventory
        set on_hand_qty = on_hand_qty - $3
        where branch_id = $1
          and variant_id = $2
          and on_hand_qty >= $3
        returning *
        `,
        [payload.branch_id, item.variant_id, item.quantity]
      );

      if (updateInventoryResult.rows.length === 0) {
        throw new HttpError(409, `Stock update conflict for variant ${item.variant_id}.`);
      }

      await client.query(
        `
        insert into public.inventory_movements (
          branch_id,
          variant_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          notes,
          created_by_account_id
        )
        values ($1, $2, 'OUT', $3, 'RECEIPT', $4, 'Auto deduction from sale', $5)
        `,
        [
          payload.branch_id,
          item.variant_id,
          item.quantity,
          receipt.id,
          payload.cashier_account_id
        ]
      );
    }

    return {
      receipt,
      items: lineItems
    };
  });
}

export async function listReceipts(filters) {
  const clauses = [];
  const params = [];

  if (filters.branch_id) {
    params.push(filters.branch_id);
    clauses.push(`branch_id = $${params.length}`);
  }

  if (filters.from) {
    params.push(filters.from);
    clauses.push(`sold_at >= $${params.length}`);
  }

  if (filters.to) {
    params.push(filters.to);
    clauses.push(`sold_at < $${params.length}`);
  }

  const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await query(
    `
    select *
    from public.sales_receipts
    ${whereClause}
    order by sold_at desc
    limit 500
    `,
    params
  );

  return result.rows;
}

export async function getReceiptById(receiptId) {
  const receiptResult = await query(
    `
    select *
    from public.sales_receipts
    where id = $1
    `,
    [receiptId]
  );

  if (receiptResult.rows.length === 0) {
    throw new HttpError(404, "Receipt not found.");
  }

  const itemsResult = await query(
    `
    select *
    from public.sales_receipt_items
    where receipt_id = $1
    order by created_at asc
    `,
    [receiptId]
  );

  return {
    receipt: receiptResult.rows[0],
    items: itemsResult.rows
  };
}

export async function voidReceipt(receiptId, payload) {
  return withTransaction(async (client) => {
    const receiptResult = await client.query(
      `
      select *
      from public.sales_receipts
      where id = $1
      for update
      `,
      [receiptId]
    );

    if (receiptResult.rows.length === 0) {
      throw new HttpError(404, "Receipt not found.");
    }

    const receipt = receiptResult.rows[0];

    if (receipt.status === "VOIDED") {
      throw new HttpError(409, "Receipt is already voided.");
    }

    await client.query(
      `
      update public.sales_receipts
      set
        status = 'VOIDED',
        voided_by_account_id = $2,
        voided_at = now(),
        void_reason = $3
      where id = $1
      `,
      [receiptId, payload.voided_by_account_id, payload.void_reason ?? null]
    );

    const itemsResult = await client.query(
      `
      select variant_id, quantity
      from public.sales_receipt_items
      where receipt_id = $1
      `,
      [receiptId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `
        update public.branch_variant_inventory
        set on_hand_qty = on_hand_qty + $3
        where branch_id = $1 and variant_id = $2
        `,
        [receipt.branch_id, item.variant_id, item.quantity]
      );

      await client.query(
        `
        insert into public.inventory_movements (
          branch_id,
          variant_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          notes,
          created_by_account_id
        )
        values ($1, $2, 'IN', $3, 'RECEIPT_VOID', $4, 'Stock returned from void receipt', $5)
        `,
        [
          receipt.branch_id,
          item.variant_id,
          item.quantity,
          receiptId,
          payload.voided_by_account_id
        ]
      );
    }

    const updatedResult = await client.query(
      `
      select *
      from public.sales_receipts
      where id = $1
      `,
      [receiptId]
    );

    return updatedResult.rows[0];
  });
}
