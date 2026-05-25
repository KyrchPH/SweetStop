import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  createProduct,
  createVariant,
  listProducts,
  updateBranchVariantConfig,
  updateBranchVariantInventory
} from "../controllers/catalog.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(authenticate);

router.get("/products", authorize("product.view"), asyncHandler(listProducts));
router.post("/products", authorize("product.create"), asyncHandler(createProduct));
router.post("/products/:productId/variants", authorize("product.create"), asyncHandler(createVariant));
router.patch(
  "/branches/:branchId/variants/:variantId/config",
  authorize("product.branch_availability.update"),
  asyncHandler(updateBranchVariantConfig)
);
router.patch(
  "/branches/:branchId/variants/:variantId/inventory",
  authorize("inventory.adjust"),
  asyncHandler(updateBranchVariantInventory)
);

export default router;
