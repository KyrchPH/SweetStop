import { Router } from "express";

import {
  generateDailyReport,
  getDailyReportById,
  listDailyReports
} from "../controllers/reports.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.post("/daily/generate", asyncHandler(generateDailyReport));
router.get("/daily", asyncHandler(listDailyReports));
router.get("/daily/:reportId", asyncHandler(getDailyReportById));

export default router;
