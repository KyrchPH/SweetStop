import * as accessService from "../services/access.service.js";
import * as authService from "../services/auth.service.js";
import { HttpError } from "../utils/http-error.js";
import {
  assertNonEmptyString,
  assertUuid,
  parseBooleanOrUndefined,
  parseDateOnly
} from "../utils/validators.js";

function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim() !== "") {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}

export async function listRoles(_req, res) {
  const data = await accessService.listRoles();
  res.status(200).json({ ok: true, data });
}

export async function listPermissions(_req, res) {
  const data = await accessService.listPermissions();
  res.status(200).json({ ok: true, data });
}

export async function listAccounts(req, res) {
  const branchId = req.query.branch_id;

  if (branchId) {
    assertUuid(branchId, "branch_id");
  }

  const data = await accessService.listAccounts(branchId);
  res.status(200).json({ ok: true, data });
}

export async function createAccount(req, res) {
  const {
    firstname,
    lastname,
    gender,
    birthdate,
    username,
    contact_no,
    email_address,
    access_id,
    access_code,
    password,
    password_hash,
    status
  } = req.body ?? {};

  assertNonEmptyString(firstname, "firstname");
  assertNonEmptyString(lastname, "lastname");
  assertNonEmptyString(username, "username");
  assertNonEmptyString(email_address, "email_address");

  if (!password_hash) {
    assertNonEmptyString(password, "password");
  }

  const data = await accessService.createAccount({
    firstname: firstname.trim(),
    lastname: lastname.trim(),
    gender,
    birthdate: birthdate ? parseDateOnly(birthdate, "birthdate") : null,
    username: username.trim(),
    contact_no,
    email_address: email_address.trim(),
    access_id,
    access_code,
    password,
    password_hash,
    status,
    actor_account_id: req.auth?.account_id
  });

  res.status(201).json({ ok: true, data });
}

export async function updateAccountAccess(req, res) {
  const { accountId } = req.params;
  const { access_id } = req.body ?? {};

  assertUuid(accountId, "accountId");

  if (access_id === undefined || access_id === null) {
    throw new HttpError(400, "access_id is required.");
  }

  const data = await accessService.updateAccountAccess(accountId, {
    access_id,
    actor_account_id: req.auth.account_id
  });
  res.status(200).json({ ok: true, data });
}

export async function updateAccountStatus(req, res) {
  const { accountId } = req.params;
  const { status } = req.body ?? {};

  assertUuid(accountId, "accountId");
  assertNonEmptyString(status, "status");

  const data = await accessService.updateAccountStatus(accountId, {
    status,
    actor_account_id: req.auth.account_id
  });

  res.status(200).json({ ok: true, data });
}

export async function updateAccountPassword(req, res) {
  const { accountId } = req.params;
  const { password } = req.body ?? {};

  assertUuid(accountId, "accountId");
  assertNonEmptyString(password, "password");

  if (password.trim().length < 8) {
    throw new HttpError(400, "password must be at least 8 characters.");
  }

  const data = await accessService.updateAccountPassword(accountId, {
    password,
    actor_account_id: req.auth.account_id
  });

  res.status(200).json({ ok: true, data });
}

export async function upsertBranchRole(req, res) {
  const { accountId } = req.params;
  const { branch_id, access_id, is_primary } = req.body ?? {};

  assertUuid(accountId, "accountId");
  assertUuid(branch_id, "branch_id");

  if (access_id === undefined || access_id === null) {
    throw new HttpError(400, "access_id is required.");
  }

  parseBooleanOrUndefined(is_primary, "is_primary");

  const data = await accessService.upsertBranchRole(accountId, {
    branch_id,
    access_id,
    is_primary,
    actor_account_id: req.auth.account_id
  });

  res.status(200).json({ ok: true, data });
}

export async function login(req, res) {
  const { identifier, password, branch_id } = req.body ?? {};

  assertNonEmptyString(identifier, "identifier");
  assertNonEmptyString(password, "password");

  if (branch_id) {
    assertUuid(branch_id, "branch_id");
  }

  const data = await authService.loginWithPassword({
    identifier: identifier.trim(),
    password,
    branch_id,
    issued_from_ip: getRequestIp(req),
    user_agent: req.headers["user-agent"] ?? null
  });

  res.status(200).json({ ok: true, data });
}

export async function refreshSession(req, res) {
  const { refresh_token, branch_id } = req.body ?? {};

  assertNonEmptyString(refresh_token, "refresh_token");

  if (branch_id) {
    assertUuid(branch_id, "branch_id");
  }

  const data = await authService.refreshSession({
    refresh_token: refresh_token.trim(),
    branch_id,
    issued_from_ip: getRequestIp(req),
    user_agent: req.headers["user-agent"] ?? null
  });

  res.status(200).json({ ok: true, data });
}

export async function logout(req, res) {
  const { refresh_token } = req.body ?? {};
  assertNonEmptyString(refresh_token, "refresh_token");

  const data = await authService.logoutWithRefreshToken({
    refresh_token: refresh_token.trim()
  });

  res.status(200).json({ ok: true, data });
}

export async function requestPasswordReset(req, res) {
  const { identifier } = req.body ?? {};
  assertNonEmptyString(identifier, "identifier");

  const data = await authService.requestPasswordReset({
    identifier: identifier.trim(),
    requested_from_ip: getRequestIp(req)
  });

  res.status(200).json({ ok: true, data });
}

export async function confirmPasswordReset(req, res) {
  const { reset_token, new_password } = req.body ?? {};
  assertNonEmptyString(reset_token, "reset_token");
  assertNonEmptyString(new_password, "new_password");

  const data = await authService.confirmPasswordReset({
    reset_token: reset_token.trim(),
    new_password
  });

  res.status(200).json({ ok: true, data });
}

export async function me(req, res) {
  const { auth } = req;

  if (!auth) {
    throw new HttpError(401, "Authentication required.");
  }

  const data = {
    account_id: auth.account_id,
    user_id: auth.user_id,
    username: auth.username,
    email_address: auth.email_address,
    firstname: auth.firstname,
    lastname: auth.lastname,
    status: auth.status,
    global_access_id: auth.global_access_id,
    global_access_code: auth.global_access_code,
    global_permissions: auth.global_permissions,
    branch_roles: auth.branch_roles
  };

  res.status(200).json({ ok: true, data });
}

export async function createBootstrapAdmin(req, res) {
  const {
    firstname,
    lastname,
    gender,
    birthdate,
    username,
    contact_no,
    email_address,
    password
  } = req.body ?? {};

  assertNonEmptyString(firstname, "firstname");
  assertNonEmptyString(lastname, "lastname");
  assertNonEmptyString(username, "username");
  assertNonEmptyString(email_address, "email_address");
  assertNonEmptyString(password, "password");

  const data = await accessService.createBootstrapAdmin({
    firstname: firstname.trim(),
    lastname: lastname.trim(),
    gender,
    birthdate: birthdate ? parseDateOnly(birthdate, "birthdate") : null,
    username: username.trim(),
    contact_no,
    email_address: email_address.trim(),
    password,
    actor_account_id: null
  });

  res.status(201).json({ ok: true, data });
}
