import { HttpError } from "../utils/http-error.js";

const RATE_STATE = new Map();
let sweepCounter = 0;

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim() !== "") {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function maybeSweep(now) {
  sweepCounter += 1;

  if (sweepCounter % 200 !== 0) {
    return;
  }

  for (const [key, value] of RATE_STATE) {
    if (value.resetAt <= now) {
      RATE_STATE.delete(key);
    }
  }
}

export function createRateLimiter(options) {
  const windowMs = Math.max(1_000, Number(options.windowMs ?? 60_000));
  const maxRequests = Math.max(1, Number(options.maxRequests ?? 60));
  const message = options.message || "Too many requests. Please try again later.";
  const keyPrefix = options.keyPrefix || "global";
  const keyResolver =
    typeof options.keyResolver === "function"
      ? options.keyResolver
      : (req) => `${keyPrefix}:${getClientIp(req)}`;

  return function rateLimiter(req, res, next) {
    try {
      const now = Date.now();
      maybeSweep(now);

      const key = keyResolver(req);
      const existing = RATE_STATE.get(key);
      const initialState = {
        count: 0,
        resetAt: now + windowMs
      };
      const state = existing && existing.resetAt > now ? existing : initialState;

      if (state.count >= maxRequests) {
        const retryAfterSeconds = Math.ceil((state.resetAt - now) / 1_000);
        res.setHeader("Retry-After", String(Math.max(1, retryAfterSeconds)));
        throw new HttpError(429, message);
      }

      state.count += 1;
      RATE_STATE.set(key, state);

      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - state.count)));
      res.setHeader("X-RateLimit-Reset", String(Math.floor(state.resetAt / 1_000)));

      next();
    } catch (error) {
      next(error);
    }
  };
}
