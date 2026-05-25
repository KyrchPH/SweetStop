import assert from "node:assert/strict";
import test from "node:test";

import { signToken, verifyToken } from "../src/utils/token.js";

test("signToken and verifyToken roundtrip", () => {
  const token = signToken({ sub: "account-1", token_type: "access" }, "secret-key", 120);
  const payload = verifyToken(token, "secret-key");

  assert.ok(payload);
  assert.equal(payload.sub, "account-1");
  assert.equal(payload.token_type, "access");
  assert.ok(typeof payload.iat === "number");
  assert.ok(typeof payload.exp === "number");
});

test("verifyToken rejects modified token", () => {
  const token = signToken({ sub: "account-1", token_type: "access" }, "secret-key", 120);
  const parts = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: "account-2", token_type: "access", iat: 1, exp: 9999999999 }),
    "utf8"
  )
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  assert.equal(verifyToken(tampered, "secret-key"), null);
});
