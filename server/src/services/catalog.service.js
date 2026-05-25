import { HttpError } from "../utils/http-error.js";
import { writeAuditLog } from "./audit.service.js";
import { query, withTransaction } from "./db.service.js";

function isUnavailableNow(config) {
  if (!config.manual_unavailable) {
    return false;
  }

  const now = Date.now();
  const from = config.unavailable_from ? new Date(config.unavailable_from).getTime() : null;
  const to = config.unavailable_to ? new Date(config.unavailable_to).getTime() : null;

  if (from !== null && now < from) {
    return false;
  }

  if (to !== null && now >= to) {
    return false;
  }

  return true;
}

export async function listProducts(branchId) {
  if (!branchId) {
    const productsResult = await query(
      `
      select id, category, name, photo_url, description, is_active, created_at, updated_at
      from public.products
      order by name asc
      `
    );

    const variantsResult = await query(
      `
      select id, product_id, name, sku, description, tags, is_active, created_at, updated_at
      from public.product_variants
      order by name asc
      `
    );

    const variantsByProductId = new Map();

    for (const variant of variantsResult.rows) {
      if (!variantsByProductId.has(variant.product_id)) {
        variantsByProductId.set(variant.product_id, []);
      }

      variantsByProductId.get(variant.product_id).push(variant);
    }

    return productsResult.rows.map((product) => ({
      ...product,
      variants: variantsByProductId.get(product.id) ?? []
    }));
  }

  const result = await query(
    `
    select
      p.id as product_id,
      p.category,
      p.name as product_name,
      p.photo_url,
      p.description as product_description,
      p.is_active as product_is_active,
      p.created_at as product_created_at,
      p.updated_at as product_updated_at,
      v.id as variant_id,
      v.name as variant_name,
      v.sku as variant_sku,
      v.description as variant_description,
      v.tags as variant_tags,
      v.is_active as variant_is_active,
      v.created_at as variant_created_at,
      v.updated_at as variant_updated_at,
      c.price,
      c.is_applicable,
      c.is_hidden,
      c.manual_unavailable,
      c.unavailable_from,
      c.unavailable_to,
      c.unavailable_reason,
      coalesce(i.on_hand_qty, 0) as on_hand_qty,
      coalesce(i.reorder_level, 0) as reorder_level
    from public.products p
    join public.product_variants v on v.product_id = p.id
    left join public.branch_variant_config c
      on c.variant_id = v.id
      and c.branch_id = $1
    left join public.branch_variant_inventory i
      on i.variant_id = v.id
      and i.branch_id = $1
    order by p.name asc, v.name asc
    `,
    [branchId]
  );

  const productsMap = new Map();

  for (const row of result.rows) {
    if (!productsMap.has(row.product_id)) {
      productsMap.set(row.product_id, {
        id: row.product_id,
        category: row.category,
        name: row.product_name,
        photo_url: row.photo_url,
        description: row.product_description,
        is_active: row.product_is_active,
        created_at: row.product_created_at,
        updated_at: row.product_updated_at,
        variants: []
      });
    }

    const availabilityStatus = row.is_applicable === false
      ? "NOT_APPLICABLE"
      : row.is_hidden === true
      ? "HIDDEN"
      : isUnavailableNow(row)
      ? "UNAVAILABLE"
      : Number(row.on_hand_qty) <= 0
      ? "OUT_OF_STOCK"
      : "AVAILABLE";

    productsMap.get(row.product_id).variants.push({
      id: row.variant_id,
      name: row.variant_name,
      sku: row.variant_sku,
      description: row.variant_description,
      tags: row.variant_tags,
      is_active: row.variant_is_active,
      created_at: row.variant_created_at,
      updated_at: row.variant_updated_at,
      branch_config: {
        price: row.price === null ? null : Number(row.price),
        is_applicable: row.is_applicable,
        is_hidden: row.is_hidden,
        manual_unavailable: row.manual_unavailable,
        unavailable_from: row.unavailable_from,
        unavailable_to: row.unavailable_to,
        unavailable_reason: row.unavailable_reason,
        on_hand_qty: Number(row.on_hand_qty),
        reorder_level: Number(row.reorder_level),
        availability_status: availabilityStatus
      }
    });
  }

  return Array.from(productsMap.values());
}

export async function createProduct(payload) {
  const result = await query(
    `
    insert into public.products (category, name, photo_url, description, is_active)
    values ($1, $2, $3, $4, $5)
    returning id, category, name, photo_url, description, is_active, created_at, updated_at
    `,
    [
      payload.category,
      payload.name,
      payload.photo_url ?? null,
      payload.description ?? null,
      payload.is_active ?? true
    ]
  );

  const product = result.rows[0];

  if (payload.actor_account_id) {
    await writeAuditLog({
      account_id: payload.actor_account_id,
      action: "PRODUCT_CREATED",
      entity_type: "product",
      entity_id: product.id,
      details: {
        category: product.category,
        name: product.name,
        is_active: product.is_active
      }
    });
  }

  return product;
}

export async function createVariant(productId, payload) {
  return withTransaction(async (client) => {
    const productResult = await client.query(
      `
      select id
      from public.products
      where id = $1
      `,
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new HttpError(404, "Product not found.");
    }

    const variantResult = await client.query(
      `
      insert into public.product_variants (product_id, name, sku, description, tags, is_active)
      values ($1, $2, $3, $4, $5::jsonb, $6)
      returning id, product_id, name, sku, description, tags, is_active, created_at, updated_at
      `,
      [
        productId,
        payload.name,
        payload.sku ?? null,
        payload.description ?? null,
        JSON.stringify(payload.tags ?? {}),
        payload.is_active ?? true
      ]
    );

    const variant = variantResult.rows[0];
    const defaultPrice = payload.default_price ?? 0;

    await client.query(
      `
      insert into public.branch_variant_config
      (branch_id, variant_id, price, is_applicable, is_hidden, manual_unavailable)
      select b.id, $1, $2, true, false, false
      from public.branches b
      on conflict (branch_id, variant_id) do nothing
      `,
      [variant.id, defaultPrice]
    );

    await client.query(
      `
      insert into public.branch_variant_inventory
      (branch_id, variant_id, on_hand_qty, reorder_level)
      select b.id, $1, 0, 0
      from public.branches b
      on conflict (branch_id, variant_id) do nothing
      `,
      [variant.id]
    );

    if (payload.actor_account_id) {
      await client.query(
        `
        insert into public.audit_logs (
          account_id, action, entity_type, entity_id, details
        )
        values ($1, 'PRODUCT_VARIANT_CREATED', 'product_variant', $2, $3::jsonb)
        `,
        [
          payload.actor_account_id,
          variant.id,
          JSON.stringify({
            product_id: variant.product_id,
            name: variant.name,
            default_price: Number(defaultPrice)
          })
        ]
      );
    }

    return variant;
  });
}

export async function updateBranchVariantConfig(branchId, variantId, payload) {
  return withTransaction(async (client) => {
    const existingResult = await client.query(
      `
      select id, price, is_applicable, is_hidden, manual_unavailable,
             unavailable_from, unavailable_to, unavailable_reason
      from public.branch_variant_config
      where branch_id = $1 and variant_id = $2
      `,
      [branchId, variantId]
    );

    if (existingResult.rows.length === 0) {
      const insertResult = await client.query(
        `
        insert into public.branch_variant_config (
          branch_id, variant_id, price, is_applicable, is_hidden, manual_unavailable,
          unavailable_from, unavailable_to, unavailable_reason
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning *
        `,
        [
          branchId,
          variantId,
          payload.price ?? 0,
          payload.is_applicable ?? true,
          payload.is_hidden ?? false,
          payload.manual_unavailable ?? false,
          payload.unavailable_from ?? null,
          payload.unavailable_to ?? null,
          payload.unavailable_reason ?? null
        ]
      );

      return insertResult.rows[0];
    }

    const existing = existingResult.rows[0];
    const nextValues = {
      price: payload.price ?? Number(existing.price),
      is_applicable: payload.is_applicable ?? existing.is_applicable,
      is_hidden: payload.is_hidden ?? existing.is_hidden,
      manual_unavailable: payload.manual_unavailable ?? existing.manual_unavailable,
      unavailable_from:
        payload.unavailable_from === undefined
          ? existing.unavailable_from
          : payload.unavailable_from,
      unavailable_to:
        payload.unavailable_to === undefined ? existing.unavailable_to : payload.unavailable_to,
      unavailable_reason:
        payload.unavailable_reason === undefined
          ? existing.unavailable_reason
          : payload.unavailable_reason
    };

    const updateResult = await client.query(
      `
      update public.branch_variant_config
      set
        price = $3,
        is_applicable = $4,
        is_hidden = $5,
        manual_unavailable = $6,
        unavailable_from = $7,
        unavailable_to = $8,
        unavailable_reason = $9
      where branch_id = $1 and variant_id = $2
      returning *
      `,
      [
        branchId,
        variantId,
        nextValues.price,
        nextValues.is_applicable,
        nextValues.is_hidden,
        nextValues.manual_unavailable,
        nextValues.unavailable_from,
        nextValues.unavailable_to,
        nextValues.unavailable_reason
      ]
    );

    const updated = updateResult.rows[0];

    if (payload.actor_account_id) {
      await client.query(
        `
        insert into public.audit_logs (
          branch_id, account_id, action, entity_type, entity_id, details, reason
        )
        values ($1, $2, 'BRANCH_VARIANT_CONFIG_UPDATED', 'branch_variant_config', $3, $4::jsonb, $5)
        `,
        [
          branchId,
          payload.actor_account_id,
          updated.id,
          JSON.stringify({
            price: Number(updated.price),
            is_applicable: updated.is_applicable,
            is_hidden: updated.is_hidden,
            manual_unavailable: updated.manual_unavailable,
            unavailable_from: updated.unavailable_from,
            unavailable_to: updated.unavailable_to
          }),
          updated.unavailable_reason
        ]
      );
    }

    return updated;
  });
}

export async function updateBranchVariantInventory(branchId, variantId, payload) {
  const result = await query(
    `
    insert into public.branch_variant_inventory (
      branch_id, variant_id, on_hand_qty, reorder_level
    )
    values ($1, $2, $3, $4)
    on conflict (branch_id, variant_id)
    do update set
      on_hand_qty = excluded.on_hand_qty,
      reorder_level = excluded.reorder_level,
      updated_at = now()
    returning *
    `,
    [branchId, variantId, payload.on_hand_qty, payload.reorder_level]
  );

  const inventory = result.rows[0];

  if (payload.actor_account_id) {
    await writeAuditLog({
      branch_id: branchId,
      account_id: payload.actor_account_id,
      action: "BRANCH_VARIANT_INVENTORY_UPDATED",
      entity_type: "branch_variant_inventory",
      entity_id: inventory.id,
      details: {
        variant_id: inventory.variant_id,
        on_hand_qty: Number(inventory.on_hand_qty),
        reorder_level: Number(inventory.reorder_level)
      }
    });
  }

  return inventory;
}
