-- Auth hardening extensions
-- Adds login lockout, refresh sessions, and password reset tokens.

alter table public.accounts
  add column if not exists failed_login_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists password_changed_at timestamptz not null default now();

create table if not exists public.auth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_token_id uuid references public.auth_refresh_tokens(id) on delete set null,
  revocation_reason text,
  issued_from_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists idx_auth_refresh_tokens_account_id
  on public.auth_refresh_tokens(account_id);
create index if not exists idx_auth_refresh_tokens_expires_at
  on public.auth_refresh_tokens(expires_at);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_from_ip text,
  created_at timestamptz not null default now(),
  check (used_at is null or used_at >= created_at)
);

create index if not exists idx_password_reset_tokens_account_id
  on public.password_reset_tokens(account_id);
create index if not exists idx_password_reset_tokens_expires_at
  on public.password_reset_tokens(expires_at);
