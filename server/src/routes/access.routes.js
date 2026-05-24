import { Router } from "express";

import {
  createAccount,
  listAccounts,
  listPermissions,
  listRoles,
  updateAccountAccess,
  upsertBranchRole
} from "../controllers/access.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/roles", asyncHandler(listRoles));
router.get("/permissions", asyncHandler(listPermissions));
router.get("/accounts", asyncHandler(listAccounts));
router.post("/accounts", asyncHandler(createAccount));
router.patch("/accounts/:accountId/access", asyncHandler(updateAccountAccess));
router.put("/accounts/:accountId/branch-role", asyncHandler(upsertBranchRole));

export default router;
