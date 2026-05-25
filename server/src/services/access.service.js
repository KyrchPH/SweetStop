import { HttpError } from "../utils/http-error.js";
import { hashPassword } from "../utils/password.js";
import { writeAuditLog } from "./audit.service.js";
import { query, withTransaction } from "./db.service.js";

async function resolveAccessId(client, accessId, accessCode) {
  if (accessId !== undefined && accessId !== null) {
    const roleResult = await client.query("select id from public.access_roles where id = $1", [accessId]);

    if (roleResult.rows.length === 0) {
      throw new HttpError(400, "Invalid access_id.");
    }

    return accessId;
  }

  if (accessCode) {
    const roleResult = await client.query("select id from public.access_roles where code = $1", [accessCode]);

    if (roleResult.rows.length === 0) {
      throw new HttpError(400, "Invalid access_code.");
    }

    return roleResult.rows[0].id;
  }

  const defaultRoleResult = await client.query("select id from public.access_roles where code = 'cashier'");

  if (defaultRoleResult.rows.length === 0) {
    throw new HttpError(500, "Default role 'cashier' not found.");
  }

  return defaultRoleResult.rows[0].id;
}

export async function listRoles() {
  const result = await query(
    `
    select
      r.id,
      r.code,
      r.name,
      r.description,
      coalesce(
        json_agg(p.permission_key order by p.permission_key)
        filter (where p.permission_key is not null),
        '[]'::json
      ) as permissions
    from public.access_roles r
    left join public.role_permissions rp on rp.role_id = r.id
    left join public.permissions p on p.id = rp.permission_id
    group by r.id, r.code, r.name, r.description
    order by r.id asc
    `
  );

  return result.rows;
}

export async function listPermissions() {
  const result = await query(
    `
    select id, permission_key, description, created_at, updated_at
    from public.permissions
    order by permission_key asc
    `
  );

  return result.rows;
}

export async function listAccounts(branchId) {
  if (!branchId) {
    const result = await query(
      `
      select
        a.id,
        a.username,
        a.contact_no,
        a.email_address,
        a.access_id,
        r.code as access_code,
        a.status,
        a.last_active_at,
        a.created_at,
        a.updated_at,
        u.id as user_id,
        u.firstname,
        u.lastname,
        u.gender,
        u.birthdate
      from public.accounts a
      join public.users u on u.id = a.user_id
      join public.access_roles r on r.id = a.access_id
      order by u.firstname asc, u.lastname asc
      `
    );

    return result.rows;
  }

  const result = await query(
    `
    select
      a.id,
      a.username,
      a.contact_no,
      a.email_address,
      abr.access_id,
      r.code as access_code,
      a.status,
      a.last_active_at,
      a.created_at,
      a.updated_at,
      u.id as user_id,
      u.firstname,
      u.lastname,
      u.gender,
      u.birthdate,
      abr.branch_id,
      abr.is_primary
    from public.account_branch_roles abr
    join public.accounts a on a.id = abr.account_id
    join public.users u on u.id = a.user_id
    join public.access_roles r on r.id = abr.access_id
    where abr.branch_id = $1
    order by u.firstname asc, u.lastname asc
    `,
    [branchId]
  );

  return result.rows;
}

export async function createAccount(payload) {
  return withTransaction(async (client) => {
    const accessId = await resolveAccessId(client, payload.access_id, payload.access_code);
    const passwordHash = payload.password_hash || hashPassword(payload.password);

    const userResult = await client.query(
      `
      insert into public.users (firstname, lastname, gender, birthdate)
      values ($1, $2, $3, $4)
      returning *
      `,
      [payload.firstname, payload.lastname, payload.gender ?? null, payload.birthdate ?? null]
    );

    const accountResult = await client.query(
      `
      insert into public.accounts
      (user_id, username, contact_no, email_address, access_id, password_hash, status)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning *
      `,
      [
        userResult.rows[0].id,
        payload.username,
        payload.contact_no ?? null,
        payload.email_address,
        accessId,
        passwordHash,
        payload.status ?? "ACTIVE"
      ]
    );

    if (payload.actor_account_id) {
      await client.query(
        `
        insert into public.audit_logs (
          account_id, action, entity_type, entity_id, details
        )
        values ($1, 'ACCOUNT_CREATED', 'account', $2, $3::jsonb)
        `,
        [
          payload.actor_account_id,
          accountResult.rows[0].id,
          JSON.stringify({
            username: accountResult.rows[0].username,
            access_id: accountResult.rows[0].access_id,
            status: accountResult.rows[0].status
          })
        ]
      );
    }

    return {
      user: userResult.rows[0],
      account: accountResult.rows[0]
    };
  });
}

export async function updateAccountAccess(accountId, payload) {
  const result = await query(
    `
    update public.accounts
    set access_id = $2
    where id = $1
    returning *
    `,
    [accountId, payload.access_id]
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, "Account not found.");
  }

  const account = result.rows[0];

  if (payload.actor_account_id) {
    await writeAuditLog({
      account_id: payload.actor_account_id,
      action: "ACCOUNT_ACCESS_UPDATED",
      entity_type: "account",
      entity_id: account.id,
      details: {
        access_id: account.access_id,
        username: account.username
      }
    });
  }

  return account;
}

export async function upsertBranchRole(accountId, payload) {
  const result = await query(
    `
    insert into public.account_branch_roles
    (account_id, branch_id, access_id, is_primary)
    values ($1, $2, $3, $4)
    on conflict (account_id, branch_id)
    do update set
      access_id = excluded.access_id,
      is_primary = excluded.is_primary,
      updated_at = now()
    returning *
    `,
    [accountId, payload.branch_id, payload.access_id, payload.is_primary ?? false]
  );

  const mapping = result.rows[0];

  if (payload.actor_account_id) {
    await writeAuditLog({
      branch_id: mapping.branch_id,
      account_id: payload.actor_account_id,
      action: "ACCOUNT_BRANCH_ROLE_UPSERTED",
      entity_type: "account_branch_role",
      entity_id: mapping.id,
      details: {
        account_id: mapping.account_id,
        access_id: mapping.access_id,
        is_primary: mapping.is_primary
      }
    });
  }

  return mapping;
}

export async function countAccounts() {
  const result = await query(
    `
    select count(*)::int as total
    from public.accounts
    `
  );

  return result.rows[0].total;
}

export async function createBootstrapAdmin(payload) {
  const totalAccounts = await countAccounts();

  if (totalAccounts > 0) {
    throw new HttpError(409, "Bootstrap admin can only be created when no accounts exist.");
  }

  const created = await createAccount({
    ...payload,
    access_code: "admin",
    status: "ACTIVE"
  });

  await writeAuditLog({
    action: "BOOTSTRAP_ADMIN_CREATED",
    entity_type: "account",
    entity_id: created.account.id,
    details: {
      username: created.account.username,
      access_id: created.account.access_id
    }
  });

  return created;
}
