import { Router } from "express";

import {
  createCashMovement,
  listCashMovements,
  voidCashMovement
} from "../controllers/cash.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.post("/movements", asyncHandler(createCashMovement));
router.get("/movements", asyncHandler(listCashMovements));
router.patch("/movements/:movementId/void", asyncHandler(voidCashMovement));

export default router;
