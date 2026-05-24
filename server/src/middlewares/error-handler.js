import { HttpError } from "../utils/http-error.js";

export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      ok: false,
      message: error.message,
      details: error.details ?? undefined
    });
    return;
  }

  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "23505") {
      res.status(409).json({
        ok: false,
        message: "Duplicate value violates a unique constraint.",
        details: error.detail ?? undefined
      });
      return;
    }

    if (error.code === "23503" || error.code === "23514" || error.code === "22P02") {
      res.status(400).json({
        ok: false,
        message: "Request data violates database constraints.",
        details: error.detail ?? undefined
      });
      return;
    }
  }

  res.status(500).json({
    ok: false,
    message: "Internal server error."
  });
}
