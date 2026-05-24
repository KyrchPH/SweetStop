import * as catalogService from "../services/catalog.service.js";
import { HttpError } from "../utils/http-error.js";
import {
  assertNonEmptyString,
  assertUuid,
  parseBooleanOrUndefined,
  parseIsoDate,
  parseNonNegativeNumber
} from "../utils/validators.js";

export async function listProducts(req, res) {
  const branchId = req.query.branch_id;

  if (branchId) {
    assertUuid(branchId, "branch_id");
  }

  const data = await catalogService.listProducts(branchId);
  res.status(200).json({ ok: true, data });
}

export async function createProduct(req, res) {
  const { category, name, photo_url, description, is_active } = req.body ?? {};

  assertNonEmptyString(category, "category");
  assertNonEmptyString(name, "name");
  parseBooleanOrUndefined(is_active, "is_active");

  const data = await catalogService.createProduct({
    category: category.trim(),
    name: name.trim(),
    photo_url,
    description,
    is_active
  });

  res.status(201).json({ ok: true, data });
}

export async function createVariant(req, res) {
  const { productId } = req.params;
  const { name, sku, description, tags, is_active, default_price } = req.body ?? {};

  assertUuid(productId, "productId");
  assertNonEmptyString(name, "name");
  parseBooleanOrUndefined(is_active, "is_active");

  if (tags !== undefined && (typeof tags !== "object" || tags === null || Array.isArray(tags))) {
    throw new HttpError(400, "tags must be an object.");
  }

  const defaultPrice = default_price === undefined ? undefined : parseNonNegativeNumber(default_price, "default_price");

  const data = await catalogService.createVariant(productId, {
    name: name.trim(),
    sku,
    description,
    tags,
    is_active,
    default_price: defaultPrice
  });

  res.status(201).json({ ok: true, data });
}

export async function updateBranchVariantConfig(req, res) {
  const { branchId, variantId } = req.params;
  const {
    price,
    is_applicable,
    is_hidden,
    manual_unavailable,
    unavailable_from,
    unavailable_to,
    unavailable_reason
  } = req.body ?? {};

  assertUuid(branchId, "branchId");
  assertUuid(variantId, "variantId");

  const data = await catalogService.updateBranchVariantConfig(branchId, variantId, {
    price: price === undefined ? undefined : parseNonNegativeNumber(price, "price"),
    is_applicable: parseBooleanOrUndefined(is_applicable, "is_applicable"),
    is_hidden: parseBooleanOrUndefined(is_hidden, "is_hidden"),
    manual_unavailable: parseBooleanOrUndefined(manual_unavailable, "manual_unavailable"),
    unavailable_from: unavailable_from === undefined ? undefined : parseIsoDate(unavailable_from, "unavailable_from"),
    unavailable_to: unavailable_to === undefined ? undefined : parseIsoDate(unavailable_to, "unavailable_to"),
    unavailable_reason
  });

  res.status(200).json({ ok: true, data });
}

export async function updateBranchVariantInventory(req, res) {
  const { branchId, variantId } = req.params;
  const { on_hand_qty, reorder_level } = req.body ?? {};

  assertUuid(branchId, "branchId");
  assertUuid(variantId, "variantId");

  const data = await catalogService.updateBranchVariantInventory(branchId, variantId, {
    on_hand_qty: parseNonNegativeNumber(on_hand_qty, "on_hand_qty"),
    reorder_level: reorder_level === undefined ? 0 : parseNonNegativeNumber(reorder_level, "reorder_level")
  });

  res.status(200).json({ ok: true, data });
}
