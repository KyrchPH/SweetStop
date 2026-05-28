import { createHash, randomBytes } from "node:crypto";

import { getAuthConfig } from "../config/auth.js";
import { HttpError } from "../utils/http-error.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/token.js";
import { writeAuditLog } from "./audit.service.js";
import { query, withTransaction } from "./db.service.js";

function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function generateOpaqueToken(bytes = 48) {
  return randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizePassword(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "new_password is required.");
  }

  const trimmed = value.trim();

  if (trimmed.length < 8) {
    throw new HttpError(400, "new_password must be at least 8 characters.");
  }

  return trimmed;
}

function resolveRequestMetadata(payload) {
  return {
    issued_from_ip: payload.issued_from_ip ?? null,
    user_agent: payload.user_agent ?? null
  };
}

function resolveExpiryDate(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function resolveDefaultBranchId(context) {
  if (!Array.isArray(context.branch_roles) || context.branch_roles.length === 0) {
    return null;
  }

  const primary = context.branch_roles.find((role) => role.is_primary);
  return (primary ?? context.branch_roles[0]).branch_id;
}

function resolveBranchForToken(context, requestedBranchId) {
  if (!requestedBranchId) {
    return resolveDefaultBranchId(context);
  }

  const hasBranchRole = Boolean(context.branch_roles_map?.[requestedBranchId]);
  const hasGlobalAccess = context.global_permissions.includes("account.manage");

  if (!hasBranchRole && !hasGlobalAccess) {
    throw new HttpError(403, "Branch access is not assigned to this account.");
  }

  return requestedBranchId;
}

async function getAccountRowByIdentifier(client, identifier) {
  const result = await client.query(
    `
    select
      a.id as account_id,
      a.user_id,
      a.username::text as username,
      a.email_address::text as email_address,
      a.access_id as global_access_id,
      ar.code as global_access_code,
      a.password_hash,
      a.status,
      a.failed_login_count,
      a.locked_until,
      a.password_changed_at,
      u.firstname,
      u.lastname
    from public.accounts a
    join public.users u on u.id = a.user_id
    join public.access_roles ar on ar.id = a.access_id
    where a.username = $1
       or a.email_address = $1
    limit 1
    `,
    [identifier]
  );

  return result.rows[0] ?? null;
}

async function buildAuthContextWithQuery(queryFn, accountId) {
  const accountResult = await queryFn(
    `
    select
      a.id as account_id,
      a.user_id,
      a.username::text as username,
      a.email_address::text as email_address,
      a.status,
      a.access_id as global_access_id,
      ar.code as global_access_code,
      u.firstname,
      u.lastname
    from public.accounts a
    join public.users u on u.id = a.user_id
    join public.access_roles ar on ar.id = a.access_id
    where a.id = $1
    limit 1
    `,
    [accountId]
  );

  if (accountResult.rows.length === 0) {
    return null;
  }

  const account = accountResult.rows[0];

  const globalPermissionResult = await queryFn(
    `
    select distinct p.permission_key
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = $1
    order by p.permission_key asc
    `,
    [account.global_access_id]
  );

  const branchRoleResult = await queryFn(
    `
    select
      abr.branch_id,
      abr.access_id,
      abr.is_primary,
      ar.code as access_code,
      coalesce(
        array_agg(distinct p.permission_key)
        filter (where p.permission_key is not null),
        '{}'::text[]
      ) as permissions
    from public.account_branch_roles abr
    join public.access_roles ar on ar.id = abr.access_id
    left join public.role_permissions rp on rp.role_id = abr.access_id
    left join public.permissions p on p.id = rp.permission_id
    where abr.account_id = $1
    group by abr.branch_id, abr.access_id, abr.is_primary, ar.code
    order by abr.is_primary desc, abr.branch_id asc
    `,
    [accountId]
  );

  const branchRoles = branchRoleResult.rows.map((row) => ({
    branch_id: row.branch_id,
    access_id: row.access_id,
    access_code: row.access_code,
    is_primary: row.is_primary,
    permissions: Array.isArray(row.permissions) ? row.permissions : []
  }));

  const branchRolesMap = {};

  for (const role of branchRoles) {
    branchRolesMap[role.branch_id] = role;
  }

  return {
    ...account,
    global_permissions: globalPermissionResult.rows.map((row) => row.permission_key),
    branch_roles: branchRoles,
    branch_roles_map: branchRolesMap
  };
}

async function createRefreshTokenSession(client, accountId, metadata) {
  const { refreshTokenTtlSeconds } = getAuthConfig();
  const refreshToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(refreshToken);
  const expiresAt = resolveExpiryDate(refreshTokenTtlSeconds);

  const sessionResult = await client.query(
    `
    insert into public.auth_refresh_tokens (
      account_id,
      token_hash,
      expires_at,
      issued_from_ip,
      user_agent
    )
    values ($1, $2, $3, $4, $5)
    returning id, account_id, expires_at
    `,
    [
      accountId,
      tokenHash,
      expiresAt,
      metadata.issued_from_ip,
      metadata.user_agent
    ]
  );

  return {
    refresh_token: refreshToken,
    refresh_expires_at: sessionResult.rows[0].expires_at,
    refresh_session_id: sessionResult.rows[0].id
  };
}

function buildAccessToken(context, branchId) {
  const { jwtSecret, tokenTtlSeconds } = getAuthConfig();
  const accessToken = signToken(
    {
      sub: context.account_id,
      token_type: "access",
      branch_id: branchId ?? null
    },
    jwtSecret,
    tokenTtlSeconds
  );

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: tokenTtlSeconds,
    branch_id: branchId ?? null
  };
}

async function clearFailedLoginState(client, accountId) {
  await client.query(
    `
    update public.accounts
    set
      failed_login_count = 0,
      locked_until = null
    where id = $1
    `,
    [accountId]
  );
}

async function handleFailedPasswordAttempt(client, account) {
  const { loginMaxAttempts, lockoutMinutes } = getAuthConfig();
  const failedCount = Number(account.failed_login_count ?? 0) + 1;
  const shouldLock = failedCount >= loginMaxAttempts;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + lockoutMinutes * 60_000).toISOString()
    : null;

  await client.query(
    `
    update public.accounts
    set
      failed_login_count = $2,
      locked_until = $3
    where id = $1
    `,
    [account.account_id, failedCount, lockedUntil]
  );

  return {
    failed_count: failedCount,
    locked_until: lockedUntil
  };
}

function ensureAccountActive(account) {
  if (account.status !== "ACTIVE") {
    throw new HttpError(403, "Account is not active.");
  }
}

function ensureAccountNotTemporarilyLocked(account) {
  if (!account.locked_until) {
    return false;
  }

  const lockedUntilTime = new Date(account.locked_until).getTime();

  if (Number.isNaN(lockedUntilTime)) {
    return false;
  }

  if (lockedUntilTime > Date.now()) {
    return true;
  }

  return false;
}

async function markAccountLoginSuccess(client, accountId) {
  await client.query(
    `
    update public.accounts
    set
      failed_login_count = 0,
      locked_until = null,
      last_active_at = now()
    where id = $1
    `,
    [accountId]
  );
}

async function revokeRefreshTokenByHash(client, tokenHash, reason) {
  const result = await client.query(
    `
    update public.auth_refresh_tokens
    set
      revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, $2)
    where token_hash = $1
      and revoked_at is null
    returning *
    `,
    [tokenHash, reason]
  );

  return result.rows[0] ?? null;
}

async function revokeAllRefreshTokensForAccount(client, accountId, reason) {
  await client.query(
    `
    update public.auth_refresh_tokens
    set
      revoked_at = now(),
      revocation_reason = $2
    where account_id = $1
      and revoked_at is null
    `,
    [accountId, reason]
  );
}

export async function getAccountAuthContext(accountId) {
  return buildAuthContextWithQuery((sql, params) => query(sql, params), accountId);
}

export async function loginWithPassword(payload) {
  const readClient = {
    query: (sql, params) => query(sql, params)
  };

  const account = await getAccountRowByIdentifier(readClient, payload.identifier);

  if (!account) {
    await writeAuditLog({
      action: "AUTH_LOGIN_FAILED",
      entity_type: "account",
      entity_id: payload.identifier,
      details: {
        reason: "ACCOUNT_NOT_FOUND"
      }
    });
    throw new HttpError(401, "Invalid credentials.");
  }

  ensureAccountActive(account);

  if (account.locked_until && new Date(account.locked_until).getTime() <= Date.now()) {
    await clearFailedLoginState(readClient, account.account_id);
    account.locked_until = null;
    account.failed_login_count = 0;
  }

  if (ensureAccountNotTemporarilyLocked(account)) {
    await writeAuditLog({
      account_id: account.account_id,
      action: "AUTH_LOGIN_BLOCKED_LOCKOUT",
      entity_type: "account",
      entity_id: account.account_id,
      details: {
        locked_until: account.locked_until
      }
    });
    throw new HttpError(423, "Too many failed login attempts. Try again later.");
  }

  const passwordOk = verifyPassword(payload.password, account.password_hash);

  if (!passwordOk) {
    const failed = await handleFailedPasswordAttempt(readClient, account);

    await writeAuditLog({
      account_id: account.account_id,
      action: "AUTH_LOGIN_FAILED",
      entity_type: "account",
      entity_id: account.account_id,
      details: {
        reason: "INVALID_PASSWORD",
        failed_login_count: failed.failed_count,
        locked_until: failed.locked_until
      }
    });

    if (failed.locked_until) {
      throw new HttpError(423, "Too many failed login attempts. Try again later.");
    }

    throw new HttpError(401, "Invalid credentials.");
  }

  return withTransaction(async (client) => {
    await markAccountLoginSuccess(client, account.account_id);
    const context = await buildAuthContextWithQuery(
      (sql, params) => client.query(sql, params),
      account.account_id
    );
    const branchId = resolveBranchForToken(context, payload.branch_id);
    const accessToken = buildAccessToken(context, branchId);
    const session = await createRefreshTokenSession(
      client,
      account.account_id,
      resolveRequestMetadata(payload)
    );

    await client.query(
      `
      insert into public.audit_logs (
        account_id,
        action,
        entity_type,
        entity_id,
        details
      )
      values ($1, 'AUTH_LOGIN_SUCCESS', 'account', $1::text, $2::jsonb)
      `,
      [
        account.account_id,
        JSON.stringify({
          refresh_session_id: session.refresh_session_id,
          branch_id: branchId
        })
      ]
    );

    return {
      ...accessToken,
      refresh_token: session.refresh_token,
      refresh_expires_at: session.refresh_expires_at,
      account: {
        account_id: context.account_id,
        user_id: context.user_id,
        username: context.username,
        email_address: context.email_address,
        firstname: context.firstname,
        lastname: context.lastname,
        status: context.status,
        global_access_id: context.global_access_id,
        global_access_code: context.global_access_code,
        global_permissions: context.global_permissions,
        branch_roles: context.branch_roles
      }
    };
  });
}

export async function refreshSession(payload) {
  return withTransaction(async (client) => {
    const incomingHash = hashOpaqueToken(payload.refresh_token);

    const refreshResult = await client.query(
      `
      select
        rt.*,
        a.status
      from public.auth_refresh_tokens rt
      join public.accounts a on a.id = rt.account_id
      where rt.token_hash = $1
      limit 1
      for update
      `,
      [incomingHash]
    );

    if (refreshResult.rows.length === 0) {
      throw new HttpError(401, "Invalid refresh token.");
    }

    const refreshRow = refreshResult.rows[0];
    ensureAccountActive(refreshRow);

    if (refreshRow.revoked_at) {
      throw new HttpError(401, "Refresh token is revoked.");
    }

    if (new Date(refreshRow.expires_at).getTime() <= Date.now()) {
      await revokeRefreshTokenByHash(client, incomingHash, "EXPIRED");
      throw new HttpError(401, "Refresh token is expired.");
    }

    const context = await buildAuthContextWithQuery(
      (sql, params) => client.query(sql, params),
      refreshRow.account_id
    );
    const branchId = resolveBranchForToken(context, payload.branch_id);
    const accessToken = buildAccessToken(context, branchId);
    const nextSession = await createRefreshTokenSession(
      client,
      refreshRow.account_id,
      resolveRequestMetadata(payload)
    );

    await client.query(
      `
      update public.auth_refresh_tokens
      set
        revoked_at = now(),
        replaced_by_token_id = $2,
        revocation_reason = 'ROTATED'
      where id = $1
      `,
      [refreshRow.id, nextSession.refresh_session_id]
    );

    await client.query(
      `
      insert into public.audit_logs (
        account_id,
        action,
        entity_type,
        entity_id,
        details
      )
      values ($1, 'AUTH_REFRESH_ROTATED', 'auth_refresh_token', $2::text, $3::jsonb)
      `,
      [
        refreshRow.account_id,
        refreshRow.id,
        JSON.stringify({
          replaced_by_token_id: nextSession.refresh_session_id
        })
      ]
    );

    return {
      ...accessToken,
      refresh_token: nextSession.refresh_token,
      refresh_expires_at: nextSession.refresh_expires_at
    };
  });
}

export async function logoutWithRefreshToken(payload) {
  return withTransaction(async (client) => {
    const incomingHash = hashOpaqueToken(payload.refresh_token);
    const revoked = await revokeRefreshTokenByHash(client, incomingHash, "LOGOUT");

    if (!revoked) {
      return { revoked: false };
    }

    await client.query(
      `
      insert into public.audit_logs (
        account_id,
        action,
        entity_type,
        entity_id,
        details
      )
      values ($1, 'AUTH_LOGOUT', 'auth_refresh_token', $2::text, $3::jsonb)
      `,
      [
        revoked.account_id,
        revoked.id,
        JSON.stringify({
          reason: "LOGOUT"
        })
      ]
    );

    return { revoked: true };
  });
}

export async function requestPasswordReset(payload) {
  const { passwordResetTtlMinutes, passwordResetExposeToken } = getAuthConfig();

  return withTransaction(async (client) => {
    const account = await getAccountRowByIdentifier(client, payload.identifier);

    if (!account || account.status !== "ACTIVE") {
      return {
        accepted: true
      };
    }

    await client.query(
      `
      update public.password_reset_tokens
      set used_at = now()
      where account_id = $1
        and used_at is null
      `,
      [account.account_id]
    );

    const resetToken = generateOpaqueToken(32);
    const tokenHash = hashOpaqueToken(resetToken);
    const expiresAt = new Date(Date.now() + passwordResetTtlMinutes * 60_000).toISOString();

    await client.query(
      `
      insert into public.password_reset_tokens (
        account_id,
        token_hash,
        expires_at,
        requested_from_ip
      )
      values ($1, $2, $3, $4)
      `,
      [
        account.account_id,
        tokenHash,
        expiresAt,
        payload.requested_from_ip ?? null
      ]
    );

    await client.query(
      `
      insert into public.audit_logs (
        account_id,
        action,
        entity_type,
        entity_id,
        details
      )
      values ($1, 'AUTH_PASSWORD_RESET_REQUESTED', 'account', $1::text, $2::jsonb)
      `,
      [
        account.account_id,
        JSON.stringify({
          expires_at: expiresAt
        })
      ]
    );

    return {
      accepted: true,
      expires_at: expiresAt,
      reset_token: passwordResetExposeToken ? resetToken : undefined
    };
  });
}

export async function confirmPasswordReset(payload) {
  const nextPassword = normalizePassword(payload.new_password);
  const tokenHash = hashOpaqueToken(payload.reset_token);

  return withTransaction(async (client) => {
    const resetResult = await client.query(
      `
      select
        t.*,
        a.status
      from public.password_reset_tokens t
      join public.accounts a on a.id = t.account_id
      where t.token_hash = $1
      limit 1
      for update
      `,
      [tokenHash]
    );

    if (resetResult.rows.length === 0) {
      throw new HttpError(400, "Invalid password reset token.");
    }

    const resetRow = resetResult.rows[0];

    if (resetRow.used_at) {
      throw new HttpError(400, "Password reset token is already used.");
    }

    if (new Date(resetRow.expires_at).getTime() <= Date.now()) {
      throw new HttpError(400, "Password reset token is expired.");
    }

    ensureAccountActive(resetRow);

    const newHash = hashPassword(nextPassword);

    const updateAccountResult = await client.query(
      `
      update public.accounts
      set
        password_hash = $2,
        password_changed_at = now(),
        failed_login_count = 0,
        locked_until = null,
        updated_at = now()
      where id = $1
      returning id, password_changed_at
      `,
      [resetRow.account_id, newHash]
    );

    await client.query(
      `
      update public.password_reset_tokens
      set used_at = now()
      where id = $1
      `,
      [resetRow.id]
    );

    await revokeAllRefreshTokensForAccount(client, resetRow.account_id, "PASSWORD_RESET");

    await client.query(
      `
      insert into public.audit_logs (
        account_id,
        action,
        entity_type,
        entity_id,
        details
      )
      values ($1, 'AUTH_PASSWORD_RESET_CONFIRMED', 'account', $1::text, $2::jsonb)
      `,
      [
        resetRow.account_id,
        JSON.stringify({
          password_reset_token_id: resetRow.id
        })
      ]
    );

    return {
      account_id: updateAccountResult.rows[0].id,
      password_changed_at: updateAccountResult.rows[0].password_changed_at
    };
  });
}
