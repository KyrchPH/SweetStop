import { HttpError } from "../utils/http-error.js";

function normalizePermissionInput(requiredPermissions) {
  if (typeof requiredPermissions === "string") {
    return [requiredPermissions];
  }

  if (Array.isArray(requiredPermissions)) {
    return requiredPermissions.filter((value) => typeof value === "string");
  }

  return [];
}

function getBranchIdFromRequest(req) {
  const headerBranchId = req.headers["x-branch-id"];

  if (typeof headerBranchId === "string" && headerBranchId.trim() !== "") {
    return headerBranchId.trim();
  }

  const candidates = [
    req.params?.branchId,
    req.params?.branch_id,
    req.query?.branch_id,
    req.query?.branchId,
    req.body?.branch_id,
    req.body?.branchId,
    req.auth?.token_payload?.branch_id
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

function computeEffectivePermissionSet(req) {
  if (!req.auth) {
    return new Set();
  }

  const permissionSet = new Set(req.auth.global_permissions ?? []);
  const branchId = getBranchIdFromRequest(req);

  if (branchId) {
    const branchRole = req.auth.branch_roles_map?.[branchId];

    if (branchRole && Array.isArray(branchRole.permissions)) {
      for (const permission of branchRole.permissions) {
        permissionSet.add(permission);
      }
    }
  }

  return permissionSet;
}

export function hasPermission(req, permissionKey) {
  const permissionSet = computeEffectivePermissionSet(req);
  return permissionSet.has(permissionKey);
}

export function requirePermission(req, permissionKey) {
  if (!hasPermission(req, permissionKey)) {
    throw new HttpError(403, `Missing required permission: ${permissionKey}`);
  }
}

export function authorize(requiredPermissions, options = {}) {
  const permissions = normalizePermissionInput(requiredPermissions);
  const mode = options.mode === "all" ? "all" : "any";

  return function authorizationMiddleware(req, _res, next) {
    try {
      if (!req.auth) {
        throw new HttpError(401, "Authentication required.");
      }

      if (permissions.length === 0) {
        next();
        return;
      }

      const permissionSet = computeEffectivePermissionSet(req);
      req.auth.effective_permissions = Array.from(permissionSet);

      const isAuthorized =
        mode === "all"
          ? permissions.every((permission) => permissionSet.has(permission))
          : permissions.some((permission) => permissionSet.has(permission));

      if (!isAuthorized) {
        throw new HttpError(
          403,
          `Missing required permission${permissions.length > 1 ? "s" : ""}: ${permissions.join(", ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
