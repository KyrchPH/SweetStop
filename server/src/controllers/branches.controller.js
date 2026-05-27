import * as branchesService from "../services/branches.service.js";
import { HttpError } from "../utils/http-error.js";
import { assertNonEmptyString, assertUuid } from "../utils/validators.js";

export async function listBranches(_req, res) {
  const data = await branchesService.listBranches();
  res.status(200).json({ ok: true, data });
}

export async function getBranchById(req, res) {
  const { branchId } = req.params;
  assertUuid(branchId, "branchId");

  const data = await branchesService.getBranchById(branchId);

  if (!data) {
    throw new HttpError(404, "Branch not found.");
  }

  res.status(200).json({ ok: true, data });
}

export async function createBranch(req, res) {
  const { name, address, timezone, status } = req.body ?? {};

  assertNonEmptyString(name, "name");

  const data = await branchesService.createBranch({
    name: name.trim(),
    address,
    timezone,
    status
  });

  res.status(201).json({ ok: true, data });
}

export async function updateBranch(req, res) {
  const { branchId } = req.params;
  const { name, address, timezone, status } = req.body ?? {};

  assertUuid(branchId, "branchId");

  if (name !== undefined) {
    assertNonEmptyString(name, "name");
  }

  const normalizedStatus =
    typeof status === "string" && status.trim() !== "" ? status.trim().toUpperCase() : undefined;

  if (normalizedStatus && normalizedStatus !== "ACTIVE" && normalizedStatus !== "INACTIVE") {
    throw new HttpError(400, "status must be ACTIVE or INACTIVE.");
  }

  const data = await branchesService.updateBranch(branchId, {
    name: name?.trim(),
    address,
    timezone,
    status: normalizedStatus,
    actor_account_id: req.auth.account_id
  });

  res.status(200).json({ ok: true, data });
}
