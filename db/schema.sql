create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_name text not null,
  owner_phone text not null,
  owner_email text not null,
  status text not null default 'pending_approval',
  subscription_tier text not null default 'vip_pending',
  usage_counter integer not null default 0,
  monthly_quota integer not null default 500,
  has_telegram boolean not null default false,
  has_twitter boolean not null default false,
  has_group_status boolean not null default true,
  has_wa_channels boolean not null default false,
  has_scheduling boolean not null default false,
  has_contact_saver boolean not null default false,
  google_refresh_token text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  name text not null,
  phone text not null,
  password_hash text,
  auth_provider text not null default 'credentials',
  role text not null default 'owner',
  status text not null default 'pending_approval',
  created_at timestamptz not null default now()
);

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  trigger_source text not null,
  channels jsonb not null default '[]'::jsonb,
  anti_ban_mode text not null default 'medium',
  shabbat_blocker boolean not null default true,
  clean_send boolean not null default true,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  customer_name text not null,
  file_name text not null,
  pdf_storage_key text not null,
  sent_via_whatsapp boolean not null default false,
  sent_via_email boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  referrer_name text not null,
  referral_code text not null,
  referred_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists link_clicks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  transfer_id uuid references transfers(id) on delete cascade,
  group_id text,
  short_code text not null,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);

alter table workspaces enable row level security;
alter table users enable row level security;
alter table transfers enable row level security;
alter table invoices enable row level security;
alter table affiliates enable row level security;
alter table link_clicks enable row level security;

create policy workspace_isolation_users on users
  using (workspace_id = current_setting('app.workspace_id', true)::uuid);

create policy workspace_isolation_transfers on transfers
  using (workspace_id = current_setting('app.workspace_id', true)::uuid);

create policy workspace_isolation_invoices on invoices
  using (workspace_id = current_setting('app.workspace_id', true)::uuid);

create policy workspace_isolation_affiliates on affiliates
  using (workspace_id = current_setting('app.workspace_id', true)::uuid);

create policy workspace_isolation_link_clicks on link_clicks
  using (workspace_id = current_setting('app.workspace_id', true)::uuid);
