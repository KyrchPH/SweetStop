import * as accessService from "../services/access.service.js";
import { HttpError } from "../utils/http-error.js";
import {
  assertNonEmptyString,
  assertUuid,
  parseBooleanOrUndefined,
  parseDateOnly
} from "../utils/validators.js";

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
    status
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

  const data = await accessService.updateAccountAccess(accountId, { access_id });
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
    is_primary
  });

  res.status(200).json({ ok: true, data });
}
