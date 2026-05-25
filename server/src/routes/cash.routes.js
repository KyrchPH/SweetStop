import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  createCashMovement,
  listCashMovements,
  voidCashMovement
} from "../controllers/cash.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(authenticate);

router.post("/movements", asyncHandler(createCashMovement));
router.get(
  "/movements",
  authorize(["cash.in.create", "cash.out.create", "report.daily.view"], { mode: "any" }),
  asyncHandler(listCashMovements)
);
router.patch("/movements/:movementId/void", authorize("cash.movement.void"), asyncHandler(voidCashMovement));

export default router;
