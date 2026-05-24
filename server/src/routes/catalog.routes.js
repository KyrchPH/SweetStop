import { Router } from "express";

import {
  createProduct,
  createVariant,
  listProducts,
  updateBranchVariantConfig,
  updateBranchVariantInventory
} from "../controllers/catalog.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/products", asyncHandler(listProducts));
router.post("/products", asyncHandler(createProduct));
router.post("/products/:productId/variants", asyncHandler(createVariant));
router.patch(
  "/branches/:branchId/variants/:variantId/config",
  asyncHandler(updateBranchVariantConfig)
);
router.patch(
  "/branches/:branchId/variants/:variantId/inventory",
  asyncHandler(updateBranchVariantInventory)
);

export default router;
