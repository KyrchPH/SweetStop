import { Router } from "express";

import {
  closeShift,
  getCurrentOpenShift,
  listShifts,
  openShift
} from "../controllers/shifts.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize(["shift.open", "shift.close", "report.daily.view"], { mode: "any" }), asyncHandler(listShifts));
router.get("/current", authorize(["shift.open", "shift.close", "report.daily.view"], { mode: "any" }), asyncHandler(getCurrentOpenShift));
router.post("/open", authorize("shift.open"), asyncHandler(openShift));
router.post("/:shiftId/close", authorize("shift.close"), asyncHandler(closeShift));

export default router;
