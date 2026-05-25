import { Router } from "express";

import { asyncHandler } from "../utils/async-handler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  createBranch,
  getBranchById,
  listBranches
} from "../controllers/branches.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize(["product.view", "report.daily.view", "account.manage"], { mode: "any" }), asyncHandler(listBranches));
router.get("/:branchId", authorize(["product.view", "report.daily.view", "account.manage"], { mode: "any" }), asyncHandler(getBranchById));
router.post("/", authorize("account.manage"), asyncHandler(createBranch));

export default router;
