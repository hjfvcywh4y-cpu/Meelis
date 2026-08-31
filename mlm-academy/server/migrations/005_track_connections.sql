-- MLM Academy · маршрутная архитектура v3
-- Локальная/тестовая миграция. НЕ применять к production.
-- Добавляет рабочие track_connections, connection_index и поля доступа.
-- Пример локального запуска (не выполнять в этой итерации против production):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/005_track_connections.sql

alter table track_definitions
  add column if not exists content_status text not null default 'EMPTY',
  add column if not exists access_tier text not null default 'PUBLIC_METADATA',
  add column if not exists route_status text not null default 'LOCKED',
  add column if not exists execution_mode text not null default 'PREVIEW',
  add column if not exists data_quality text not null default 'OK',
  add column if not exists payload jsonb;

alter table track_content_versions
  add column if not exists access_tier text not null default 'PAID',
  add column if not exists execution_mode text not null default 'LIVE',
  add column if not exists payload jsonb;

alter table route_rules add column if not exists payload jsonb;
alter table entry_rules add column if not exists payload jsonb;
alter table products add column if not exists payload jsonb;
alter table entitlements add column if not exists payload jsonb;
alter table track_instances add column if not exists payload jsonb;
alter table track_outcomes add column if not exists payload jsonb;
alter table route_decisions add column if not exists payload jsonb;
alter table import_runs add column if not exists payload jsonb;

create table if not exists track_connections (
  connection_id text primary key,
  from_id text not null references track_definitions(id),
  to_id text not null references track_definitions(id),
  from_canonical_id text not null,
  to_canonical_id text not null,
  rank integer not null default 0,
  relation_type text not null default '',
  relation_label text not null default '',
  condition_hint text not null default '',
  reason_text text not null default '',
  user_label text not null default '',
  activation_mode text not null,
  executable boolean not null default false,
  user_visible boolean not null default false,
  matched_route_rule_ids jsonb not null default '[]'::jsonb,
  source_layer text not null default '',
  runtime_status text not null default '',
  payload jsonb,
  created_at timestamptz not null default now(),
  constraint activation_mode_known check (activation_mode in ('LOCKED_NEXT_ACTION_SLOT', 'ROUTE_RULE'))
);

create index if not exists track_connections_from_idx on track_connections (from_id, rank);
create index if not exists track_connections_to_idx on track_connections (to_id);

create table if not exists connection_index_entries (
  id text primary key references track_definitions(id),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists archive_edges (
  edge_id text primary key,
  from_id text not null,
  to_id text not null,
  active boolean not null default false,
  status_v2 text not null,
  source text not null default '',
  payload jsonb
);

-- Document overlay used by PostgresArchitectureStore (id + payload). Local/test only.
alter table track_definitions add column if not exists id_alias text;
-- route_rules PK is rule_id; adapter may address payload via rule_id as id in a view locally.

comment on table track_connections is 'Working track-to-track map (231 design + 22 rule-derived = 253). Not an execution engine.';
comment on column track_connections.activation_mode is 'LOCKED_NEXT_ACTION_SLOT is visible to admin/installer only; Route Engine must not execute it.';
