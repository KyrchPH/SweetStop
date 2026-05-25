import assert from "node:assert/strict";
import test from "node:test";

import { authorize, hasPermission } from "../src/middlewares/authorize.js";

function createMockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    auth: {
      global_permissions: [],
      branch_roles_map: {}
    },
    ...overrides
  };
}

test("hasPermission resolves global and branch permissions", () => {
  const req = createMockReq({
    query: { branch_id: "branch-1" },
    auth: {
      global_permissions: ["product.view"],
      branch_roles_map: {
        "branch-1": {
          permissions: ["sale.create", "cash.in.create"]
        }
      }
    }
  });

  assert.equal(hasPermission(req, "product.view"), true);
  assert.equal(hasPermission(req, "sale.create"), true);
  assert.equal(hasPermission(req, "cash.out.create"), false);
});

test("authorize(any) allows when at least one permission is present", () => {
  const middleware = authorize(["cash.out.create", "sale.create"], { mode: "any" });
  const req = createMockReq({
    query: { branch_id: "branch-1" },
    auth: {
      global_permissions: [],
      branch_roles_map: {
        "branch-1": {
          permissions: ["sale.create"]
        }
      }
    }
  });

  let receivedError = null;
  middleware(req, {}, (error) => {
    receivedError = error ?? null;
  });

  assert.equal(receivedError, null);
  assert.ok(Array.isArray(req.auth.effective_permissions));
  assert.ok(req.auth.effective_permissions.includes("sale.create"));
});

test("authorize(all) fails when one permission is missing", () => {
  const middleware = authorize(["sale.create", "cash.out.create"], { mode: "all" });
  const req = createMockReq({
    query: { branch_id: "branch-1" },
    auth: {
      global_permissions: [],
      branch_roles_map: {
        "branch-1": {
          permissions: ["sale.create"]
        }
      }
    }
  });

  let receivedError = null;
  middleware(req, {}, (error) => {
    receivedError = error ?? null;
  });

  assert.ok(receivedError);
  assert.equal(receivedError.statusCode, 403);
});
