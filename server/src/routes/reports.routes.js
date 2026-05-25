import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  generateDailyReport,
  getDailyReportById,
  listDailyReports,
  updateDailyReportPdf
} from "../controllers/reports.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(authenticate);

router.post("/daily/generate", authorize("report.daily.generate"), asyncHandler(generateDailyReport));
router.get("/daily", authorize("report.daily.view"), asyncHandler(listDailyReports));
router.get("/daily/:reportId", authorize("report.daily.view"), asyncHandler(getDailyReportById));
router.patch("/daily/:reportId/pdf", authorize("report.daily.generate"), asyncHandler(updateDailyReportPdf));

export default router;
