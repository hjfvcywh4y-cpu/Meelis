-- MLM Academy route architecture v1
-- Reference PostgreSQL-compatible model. Adapt names and syntax to the actual stack.
-- Do not apply to production automatically.

create table if not exists track_definitions (
  id text primary key,
  canonical_id text not null,
  entity_type text not null,
  publish_surface text not null,
  section_code text not null,
  domain_code text not null,
  title text not null,
  situation text,
  result_promise text,
  audience text,
  implementation_status text not null,
  publication_status text not null default 'PLANNED',
  catalog_visible boolean not null default false,
  source_json jsonb not null default '{}'::jsonb,
  registry_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint track_id_format check (id ~ '^A[1-6]-[0-9]{3}$'),
  constraint canonical_track_id_format check (canonical_id ~ '^A[1-6]-[0-9]{3}$')
);

create table if not exists track_content_versions (
  id text primary key,
  track_id text not null references track_definitions(id),
  content_version text not null,
  content_status text not null,
  content_format text not null,
  private_content_ref text,
  checksum text not null,
  product_policy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (track_id, content_version)
);

create table if not exists route_rules (
  rule_id text primary key,
  from_track_id text not null references track_definitions(id),
  outcome_code text not null,
  field_path text not null,
  operator_code text not null,
  expected_value_json jsonb,
  destination_type text not null,
  destination_id text references track_definitions(id),
  reason_text text,
  stop_rule text,
  recovery_json jsonb,
  priority integer not null,
  owner_label text,
  rule_version text not null,
  rule_status text not null,
  source_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists route_rules_match_idx
  on route_rules (from_track_id, outcome_code, rule_status, priority, rule_id);

create table if not exists entry_rules (
  entry_rule_id text primary key,
  source_type text not null,
  signal_code text not null,
  guard_json jsonb not null,
  destination_id text not null references track_definitions(id),
  rule_status text not null,
  version text not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  product_code text primary key,
  title text not null,
  product_status text not null,
  grants_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entitlements (
  entitlement_id text primary key,
  user_id text not null,
  product_code text not null references products(product_code),
  entitlement_status text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  source_payment_event_id text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entitlements_user_status_idx
  on entitlements (user_id, entitlement_status, starts_at, ends_at);

create table if not exists payment_events (
  payment_event_id text primary key,
  provider_code text not null,
  provider_event_id text not null,
  idempotency_key text not null unique,
  signature_verified boolean not null default false,
  event_type text not null,
  product_code text,
  user_id text,
  amount_minor bigint,
  currency_code text,
  event_status text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider_code, provider_event_id)
);

create table if not exists track_instances (
  instance_id text primary key,
  user_id text not null,
  track_id text not null references track_definitions(id),
  content_version text,
  instance_status text not null,
  parent_route_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  wait_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists track_instances_user_idx
  on track_instances (user_id, instance_status, updated_at desc);

create table if not exists track_outcomes (
  outcome_event_id text primary key,
  client_event_id text not null,
  instance_id text not null references track_instances(instance_id),
  user_id text not null,
  track_id text not null references track_definitions(id),
  outcome_code text not null,
  safe_facts_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create table if not exists route_decisions (
  decision_id text primary key,
  outcome_event_id text not null references track_outcomes(outcome_event_id),
  user_id text not null,
  from_track_id text not null references track_definitions(id),
  matched_rule_id text references route_rules(rule_id),
  rule_snapshot_json jsonb,
  destination_type text not null,
  destination_id text references track_definitions(id),
  reason_code text not null,
  locked boolean not null default true,
  lock_reason text,
  created_at timestamptz not null default now()
);

create table if not exists route_assignments (
  assignment_id text primary key,
  user_id text not null,
  source_decision_id text references route_decisions(decision_id),
  destination_type text not null,
  destination_id text,
  assignment_status text not null,
  available_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists import_runs (
  import_run_id text primary key,
  import_type text not null,
  source_filename text not null,
  source_checksum text not null,
  dry_run boolean not null,
  import_status text not null,
  diff_json jsonb not null default '{}'::jsonb,
  initiated_by_user_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Personal contact details, message texts and free-form notes are intentionally absent.
-- Identity-provider sessions may live in an existing auth subsystem; do not store raw session tokens here.

