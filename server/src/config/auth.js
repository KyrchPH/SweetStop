export function getAuthConfig() {
  const configuredSecret = process.env.AUTH_JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  const jwtSecret =
    configuredSecret && configuredSecret.trim() !== ""
      ? configuredSecret
      : isProduction
        ? null
        : "dev-insecure-secret-change-me";

  if (!jwtSecret) {
    throw new Error("AUTH_JWT_SECRET is not configured.");
  }

  const ttlFromEnv = Number(process.env.AUTH_TOKEN_TTL_SECONDS);
  const tokenTtlSeconds =
    Number.isFinite(ttlFromEnv) && ttlFromEnv > 0 ? Math.floor(ttlFromEnv) : 28800;

  const refreshTtlFromEnv = Number(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS);
  const refreshTokenTtlSeconds =
    Number.isFinite(refreshTtlFromEnv) && refreshTtlFromEnv > 0
      ? Math.floor(refreshTtlFromEnv)
      : 1209600;

  const loginMaxAttemptsFromEnv = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS);
  const loginMaxAttempts =
    Number.isFinite(loginMaxAttemptsFromEnv) && loginMaxAttemptsFromEnv > 0
      ? Math.floor(loginMaxAttemptsFromEnv)
      : 5;

  const lockoutMinutesFromEnv = Number(process.env.AUTH_LOCKOUT_MINUTES);
  const lockoutMinutes =
    Number.isFinite(lockoutMinutesFromEnv) && lockoutMinutesFromEnv > 0
      ? Math.floor(lockoutMinutesFromEnv)
      : 15;

  const resetTokenTtlMinutesFromEnv = Number(process.env.AUTH_PASSWORD_RESET_TTL_MINUTES);
  const passwordResetTtlMinutes =
    Number.isFinite(resetTokenTtlMinutesFromEnv) && resetTokenTtlMinutesFromEnv > 0
      ? Math.floor(resetTokenTtlMinutesFromEnv)
      : 30;

  const exposeResetTokenFromEnv = process.env.AUTH_PASSWORD_RESET_EXPOSE_TOKEN;
  const passwordResetExposeToken =
    typeof exposeResetTokenFromEnv === "string"
      ? ["1", "true", "yes", "on"].includes(exposeResetTokenFromEnv.trim().toLowerCase())
      : !isProduction;

  return {
    jwtSecret,
    tokenTtlSeconds,
    refreshTokenTtlSeconds,
    loginMaxAttempts,
    lockoutMinutes,
    passwordResetTtlMinutes,
    passwordResetExposeToken
  };
}
