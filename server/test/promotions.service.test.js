import assert from "node:assert/strict";
import test from "node:test";

import { calculatePromotionDiscount } from "../src/services/promotions.service.js";

test("calculatePromotionDiscount applies percent discounts to subtotal", () => {
  const discount = calculatePromotionDiscount(
    {
      discount_type: "PERCENT",
      discount_value: 15
    },
    200
  );

  assert.equal(discount, 30);
});

test("calculatePromotionDiscount caps fixed discounts at subtotal", () => {
  const discount = calculatePromotionDiscount(
    {
      discount_type: "FIXED",
      discount_value: 500
    },
    120
  );

  assert.equal(discount, 120);
});
