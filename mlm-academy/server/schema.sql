-- MLM Academy · серверное хранение кабинета
-- Применять в Supabase SQL editor. Секреты в этот файл не класть.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  ma_id text unique,
  email text unique not null,
  name text,
  phone text,
  groups text[] not null default array['FREE']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  partner_role text,
  experience text,
  current_task text,
  difficulty text,
  desired_result text,
  available_time text,
  selected_section_id text,
  consent_at timestamptz,
  onboarding_complete boolean not null default false,
  onboarding_skipped boolean not null default false,
  notify_email boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  title text not null,
  kind text not null check (kind in ('pack', 'track', 'subscription')),
  group_name text,
  price_cents integer not null default 0,
  currency text not null default 'RUB',
  active boolean not null default true
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  user_id uuid references users(id),
  ma_id text,
  email text not null,
  product_id text not null references products(id),
  track_id text,
  status text not null check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded', 'expired')),
  amount_cents integer not null default 0,
  currency text not null default 'RUB',
  test boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  payment_id text unique not null,
  order_id text not null references orders(order_id),
  idempotency_key text unique not null,
  status text not null check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded', 'expired')),
  email text,
  payload_hash text,
  created_at timestamptz not null default now()
);

create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_id text not null,
  group_name text,
  track_id text,
  order_id text,
  status text not null check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, order_id)
);

create table if not exists saved_tracks (
  user_id uuid not null references users(id) on delete cascade,
  track_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists user_routes (
  user_id uuid primary key references users(id) on delete cascade,
  track_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists track_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  track_id text not null,
  status text not null,
  step text,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create table if not exists step_progress (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references track_runs(id) on delete cascade,
  step text not null,
  completed_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  track_id text,
  kind text not null,
  preview text,
  created_at timestamptz not null default now()
);

create table if not exists search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  chain_id text,
  query text,
  result_ids text[],
  selected_track_id text,
  created_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  name text not null,
  chain_id text,
  item_id text,
  source_page text,
  created_at timestamptz not null default now()
);

insert into products (id, title, kind, group_name, price_cents)
values
  ('start', 'Стартовый пакет', 'pack', 'START', 0),
  ('full', 'Полная библиотека', 'pack', 'FULL', 0)
on conflict (id) do nothing;

alter table users enable row level security;
alter table profiles enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table entitlements enable row level security;
alter table saved_tracks enable row level security;
alter table user_routes enable row level security;
alter table track_runs enable row level security;
alter table step_progress enable row level security;
alter table artifacts enable row level security;
alter table search_events enable row level security;
alter table analytics_events enable row level security;

-- Политики: пользователь читает только свои строки. Запись платежей — только service role.
create policy users_self on users for select using (auth.jwt()->>'email' = email);
create policy profiles_self on profiles for all using (user_id in (select id from users where email = auth.jwt()->>'email'));
create policy entitlements_self on entitlements for select using (user_id in (select id from users where email = auth.jwt()->>'email'));
create policy saved_self on saved_tracks for all using (user_id in (select id from users where email = auth.jwt()->>'email'));
create policy routes_self on user_routes for all using (user_id in (select id from users where email = auth.jwt()->>'email'));
create policy runs_self on track_runs for all using (user_id in (select id from users where email = auth.jwt()->>'email'));
create policy artifacts_self on artifacts for select using (user_id in (select id from users where email = auth.jwt()->>'email'));

-- identityLevel: tilda_unverified по умолчанию. verified ставит только service role
-- после Supabase Auth / webhook. Клиентским bind это поле не повышается.
alter table users add column if not exists auth_user_id uuid unique;
alter table users add column if not exists identity_level text not null default 'tilda_unverified';
alter table users add constraint users_identity_level_check
  check (identity_level in ('tilda_unverified', 'verified'));

alter table user_routes add column if not exists session_sid text;

-- Предпочтительные политики по auth.uid() (после привязки auth_user_id).
-- Старые политики по email остаются для поэтапного перехода.
create policy users_auth_uid on users for select using (auth_user_id = auth.uid());
create policy profiles_auth_uid on profiles for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);
create policy entitlements_auth_uid on entitlements for select using (
  user_id in (select id from users where auth_user_id = auth.uid() and identity_level = 'verified')
);
create policy saved_auth_uid on saved_tracks for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);
create policy routes_auth_uid on user_routes for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);
create policy runs_auth_uid on track_runs for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);
create policy artifacts_auth_uid on artifacts for select using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

-- Платежи и права пишет только service role, не anon/authenticated клиент.
revoke insert, update, delete on entitlements from anon, authenticated;
revoke insert, update, delete on payments from anon, authenticated;
revoke insert, update, delete on orders from anon, authenticated;
