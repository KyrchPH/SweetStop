import { Router } from "express";

import {
  confirmPasswordReset,
  createBootstrapAdmin,
  createAccount,
  login,
  logout,
  listAccounts,
  listPermissions,
  listRoles,
  me,
  refreshSession,
  requestPasswordReset,
  updateAccountAccess,
  upsertBranchRole
} from "../controllers/access.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { createRateLimiter } from "../middlewares/rate-limit.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const authWindowSeconds = Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS);
const authWindowMs =
  Number.isFinite(authWindowSeconds) && authWindowSeconds > 0
    ? Math.floor(authWindowSeconds * 1000)
    : 300_000;
const loginMax = Number(process.env.AUTH_RATE_LIMIT_LOGIN_MAX);
const refreshMax = Number(process.env.AUTH_RATE_LIMIT_REFRESH_MAX);
const resetRequestMax = Number(process.env.AUTH_RATE_LIMIT_RESET_REQUEST_MAX);
const resetConfirmMax = Number(process.env.AUTH_RATE_LIMIT_RESET_CONFIRM_MAX);

const loginRateLimiter = createRateLimiter({
  keyPrefix: "auth-login",
  windowMs: authWindowMs,
  maxRequests: Number.isFinite(loginMax) && loginMax > 0 ? Math.floor(loginMax) : 10,
  message: "Too many login attempts. Please try again later."
});

const refreshRateLimiter = createRateLimiter({
  keyPrefix: "auth-refresh",
  windowMs: authWindowMs,
  maxRequests: Number.isFinite(refreshMax) && refreshMax > 0 ? Math.floor(refreshMax) : 20,
  message: "Too many token refresh attempts. Please try again later."
});

const resetRequestRateLimiter = createRateLimiter({
  keyPrefix: "auth-reset-request",
  windowMs: authWindowMs,
  maxRequests:
    Number.isFinite(resetRequestMax) && resetRequestMax > 0 ? Math.floor(resetRequestMax) : 6,
  message: "Too many password reset requests. Please try again later."
});

const resetConfirmRateLimiter = createRateLimiter({
  keyPrefix: "auth-reset-confirm",
  windowMs: authWindowMs,
  maxRequests:
    Number.isFinite(resetConfirmMax) && resetConfirmMax > 0 ? Math.floor(resetConfirmMax) : 8,
  message: "Too many password reset confirmations. Please try again later."
});

router.post("/login", loginRateLimiter, asyncHandler(login));
router.post("/refresh", refreshRateLimiter, asyncHandler(refreshSession));
router.post("/logout", refreshRateLimiter, asyncHandler(logout));
router.post("/password-reset/request", resetRequestRateLimiter, asyncHandler(requestPasswordReset));
router.post("/password-reset/confirm", resetConfirmRateLimiter, asyncHandler(confirmPasswordReset));
router.post("/bootstrap/admin", asyncHandler(createBootstrapAdmin));

router.use(authenticate);

router.get("/me", asyncHandler(me));
router.get("/roles", authorize("role.manage"), asyncHandler(listRoles));
router.get("/permissions", authorize("role.manage"), asyncHandler(listPermissions));
router.get("/accounts", authorize("account.manage"), asyncHandler(listAccounts));
router.post("/accounts", authorize("account.manage"), asyncHandler(createAccount));
router.patch("/accounts/:accountId/access", authorize("account.manage"), asyncHandler(updateAccountAccess));
router.put("/accounts/:accountId/branch-role", authorize("account.manage"), asyncHandler(upsertBranchRole));

export default router;
