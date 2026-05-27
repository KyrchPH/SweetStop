export function formatMoney(value) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

export function formatQuantity(value) {
  const numberValue = Number(value ?? 0);
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(3);
}

export function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function getTodayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

export function getStartOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function getStartOfTomorrowIso() {
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  return date.toISOString();
}

export function flattenBranchProducts(products = []) {
  return products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      variant_id: variant.id,
      variant_name: variant.name,
      sku: variant.sku,
      price: Number(variant.branch_config?.price ?? 0),
      on_hand_qty: Number(variant.branch_config?.on_hand_qty ?? 0),
      availability_status: variant.branch_config?.availability_status ?? "UNKNOWN",
      is_sellable:
        variant.branch_config?.availability_status === "AVAILABLE" &&
        Number(variant.branch_config?.price ?? 0) >= 0
    }))
  );
}
