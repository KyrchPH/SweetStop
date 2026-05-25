import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, verifyPassword } from "../src/utils/password.js";

test("hashPassword creates verifiable hash", () => {
  const password = "StrongPass123!";
  const hashed = hashPassword(password);

  assert.ok(typeof hashed === "string");
  assert.ok(hashed.startsWith("scrypt:"));
  assert.equal(verifyPassword(password, hashed), true);
  assert.equal(verifyPassword("wrong-password", hashed), false);
});
