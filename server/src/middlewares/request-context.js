import { randomUUID } from "node:crypto";

import { logger } from "../utils/logger.js";

function resolveRequestId(req) {
  const incoming = req.headers["x-request-id"];

  if (typeof incoming === "string" && incoming.trim() !== "") {
    return incoming.trim();
  }

  return randomUUID();
}

function resolveRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim() !== "") {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function requestContext(req, res, next) {
  const requestId = resolveRequestId(req);
  req.requestId = requestId;
  req.requestIp = resolveRequestIp(req);
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function requestLogger(req, res, next) {
  const startAt = process.hrtime.bigint();

  res.on("finish", () => {
    const elapsedNs = process.hrtime.bigint() - startAt;
    const durationMs = Number(elapsedNs) / 1_000_000;

    logger.info("HTTP request completed", {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      ip: req.requestIp,
      user_agent: req.headers["user-agent"] ?? null,
      account_id: req.auth?.account_id ?? null
    });
  });

  next();
}
