import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";

export function errorHandler(error, _req, res, _next) {
  const requestId = _req.requestId ?? null;

  if (error instanceof HttpError) {
    logger.warn("HTTP error response", {
      request_id: requestId,
      status_code: error.statusCode,
      message: error.message,
      details: error.details ?? null
    });

    res.status(error.statusCode).json({
      ok: false,
      message: error.message,
      details: error.details ?? undefined,
      request_id: requestId
    });
    return;
  }

  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "23505") {
      logger.warn("Database unique constraint violation", {
        request_id: requestId,
        code: error.code,
        detail: error.detail ?? null
      });

      res.status(409).json({
        ok: false,
        message: "Duplicate value violates a unique constraint.",
        details: error.detail ?? undefined,
        request_id: requestId
      });
      return;
    }

    if (error.code === "23503" || error.code === "23514" || error.code === "22P02") {
      logger.warn("Database constraint violation", {
        request_id: requestId,
        code: error.code,
        detail: error.detail ?? null
      });

      res.status(400).json({
        ok: false,
        message: "Request data violates database constraints.",
        details: error.detail ?? undefined,
        request_id: requestId
      });
      return;
    }
  }

  logger.error("Unhandled server error", {
    request_id: requestId,
    message: error?.message ?? "Unknown error",
    stack: error?.stack ?? null
  });

  res.status(500).json({
    ok: false,
    message: "Internal server error.",
    request_id: requestId
  });
}
