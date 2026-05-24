import { Router } from "express";

import { asyncHandler } from "../utils/async-handler.js";
import {
  createBranch,
  getBranchById,
  listBranches
} from "../controllers/branches.controller.js";

const router = Router();

router.get("/", asyncHandler(listBranches));
router.get("/:branchId", asyncHandler(getBranchById));
router.post("/", asyncHandler(createBranch));

export default router;
