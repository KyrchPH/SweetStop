import assert from "node:assert/strict";
import test from "node:test";

import { flattenBranchProducts, formatQuantity } from "../src/utils/formatters.js";

test("formatQuantity keeps integers compact", () => {
  assert.equal(formatQuantity(12), "12");
  assert.equal(formatQuantity("1.5"), "1.500");
});

test("flattenBranchProducts exposes branch variant details", () => {
  const rows = flattenBranchProducts([
    {
      id: "product-1",
      name: "Cake",
      category: "Dessert",
      is_active: true,
      variants: [
        {
          id: "variant-1",
          name: "Slice",
          sku: "CAKE-SLICE",
          tags: { size: "slice" },
          branch_config: {
            price: 120,
            on_hand_qty: 5,
            availability_status: "AVAILABLE"
          }
        }
      ]
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].product_name, "Cake");
  assert.equal(rows[0].variant_name, "Slice");
  assert.equal(rows[0].is_sellable, true);
});
