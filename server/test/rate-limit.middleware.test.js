import assert from "node:assert/strict";
import test from "node:test";

import { createRateLimiter } from "../src/middlewares/rate-limit.js";

function createMockReq(ip = "127.0.0.1") {
  return {
    headers: {},
    ip,
    socket: { remoteAddress: ip }
  };
}

function createMockRes() {
  const headers = {};

  return {
    headers,
    setHeader(name, value) {
      headers[name] = value;
    }
  };
}

test("rate limiter blocks request after configured max requests", () => {
  const limiter = createRateLimiter({
    keyPrefix: `test-limit-${Date.now()}`,
    windowMs: 60_000,
    maxRequests: 2,
    message: "Too many requests."
  });
  const req = createMockReq();
  const res = createMockRes();

  let error = null;
  limiter(req, res, (incoming) => {
    error = incoming ?? null;
  });
  assert.equal(error, null);

  limiter(req, res, (incoming) => {
    error = incoming ?? null;
  });
  assert.equal(error, null);

  limiter(req, res, (incoming) => {
    error = incoming ?? null;
  });

  assert.ok(error);
  assert.equal(error.statusCode, 429);
  assert.equal(error.message, "Too many requests.");
  assert.ok(Number(res.headers["Retry-After"]) >= 1);
});
