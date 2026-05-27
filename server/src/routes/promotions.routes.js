import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  createPromotion,
  listPromotions,
  updatePromotion
} from "../controllers/promotions.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize(["promotion.view", "promotion.manage"], { mode: "any" }),
  asyncHandler(listPromotions)
);
router.post("/", authorize("promotion.manage"), asyncHandler(createPromotion));
router.patch("/:promotionId", authorize("promotion.manage"), asyncHandler(updatePromotion));

export default router;
