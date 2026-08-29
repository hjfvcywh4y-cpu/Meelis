-- MLM Academy · отключённый платёжный фундамент
-- Применять после schema.sql и 001_identity_and_rls.sql.
-- Не включает живую ЮKassa. Секреты сюда не класть.
-- PAYMENTS_ENABLED=false на приложении, пока нет verified, ключей и webhook-тестов.

alter table users add column if not exists email_normalized text;
alter table users add column if not exists display_name text;
alter table users add column if not exists source text not null default 'tilda_members';
alter table users add column if not exists tilda_member_id text;

update users set email_normalized = lower(email) where email_normalized is null and email is not null;
update users set tilda_member_id = ma_id where tilda_member_id is null and ma_id is not null;

create unique index if not exists users_email_normalized_uidx on users (email_normalized);

alter table products add column if not exists description text;
alter table products add column if not exists created_at timestamptz not null default now();
alter table products add column if not exists updated_at timestamptz not null default now();

create table if not exists plans (
  id text primary key,
  product_id text not null references products(id),
  title text not null,
  billing_period text not null check (billing_period in ('one_time', 'month', 'year')),
  price_cents integer not null,
  currency text not null default 'RUB',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists product_tracks (
  product_id text not null references products(id) on delete cascade,
  track_id text not null,
  created_at timestamptz not null default now(),
  primary key (product_id, track_id)
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(order_id) on delete cascade,
  product_id text not null references products(id),
  plan_id text references plans(id),
  track_id text,
  quantity integer not null default 1,
  amount_cents integer not null,
  currency text not null default 'RUB'
);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'yookassa',
  provider_event_id text not null,
  payment_id text,
  order_id text,
  event_type text not null,
  payload_hash text,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  refund_id text unique not null,
  payment_id text not null,
  order_id text,
  amount_cents integer not null,
  currency text not null default 'RUB',
  status text not null check (status in ('created', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

alter table entitlements add column if not exists user_uuid uuid;
update entitlements set user_uuid = user_id where user_uuid is null;
alter table entitlements add column if not exists source text not null default 'payment';
alter table entitlements add column if not exists catalog_version text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entitlements_source_check') then
    alter table entitlements add constraint entitlements_source_check
      check (source in ('payment', 'promo', 'manual', 'admin', 'migration'));
  end if;
end $$;

create table if not exists subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references users(id),
  product_id text references products(id),
  status text not null check (status in ('planned', 'pending', 'active', 'past_due', 'cancelled', 'expired')),
  provider_event_id text,
  note text,
  created_at timestamptz not null default now()
);

comment on table subscription_events is 'Контракт будущей рекуррентной подписки. Не реализовывать списания, пока владелец отдельно не решит.';

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_uuid uuid,
  subject_uuid uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function mlma_entitlement_verified_only()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from users u
    where u.id = coalesce(new.user_uuid, new.user_id)
      and u.identity_level = 'verified'
  ) then
    raise exception 'entitlement requires verified user_uuid';
  end if;
  if new.user_uuid is null then
    new.user_uuid := new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists entitlements_verified_only on entitlements;
create trigger entitlements_verified_only
before insert or update on entitlements
for each row execute function mlma_entitlement_verified_only();

create or replace function mlma_audit_entitlement()
returns trigger
language plpgsql
as $$
begin
  insert into audit_log (actor_uuid, subject_uuid, action, entity_type, entity_id, payload)
  values (
    coalesce(new.user_uuid, new.user_id),
    coalesce(new.user_uuid, new.user_id),
    tg_op,
    'entitlement',
    coalesce(new.id::text, old.id::text),
    jsonb_build_object('status', new.status, 'source', new.source, 'product_id', new.product_id)
  );
  return new;
end;
$$;

drop trigger if exists entitlements_audit on entitlements;
create trigger entitlements_audit
after insert or update on entitlements
for each row execute function mlma_audit_entitlement();

alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table payment_events enable row level security;
alter table refunds enable row level security;
alter table entitlements enable row level security;
alter table plans enable row level security;
alter table products enable row level security;
alter table product_tracks enable row level security;
alter table subscription_events enable row level security;
alter table audit_log enable row level security;

drop policy if exists orders_self_select on orders;
create policy orders_self_select on orders for select using (
  user_id in (select id from users where auth_user_id = auth.uid() and identity_level = 'verified')
);

drop policy if exists payments_self_select on payments;
create policy payments_self_select on payments for select using (
  order_id in (
    select order_id from orders
    where user_id in (select id from users where auth_user_id = auth.uid() and identity_level = 'verified')
  )
);

drop policy if exists order_items_self_select on order_items;
create policy order_items_self_select on order_items for select using (
  order_id in (
    select order_id from orders
    where user_id in (select id from users where auth_user_id = auth.uid() and identity_level = 'verified')
  )
);

drop policy if exists entitlements_self_select on entitlements;
create policy entitlements_self_select on entitlements for select using (
  coalesce(user_uuid, user_id) in (
    select id from users where auth_user_id = auth.uid() and identity_level = 'verified'
  )
);

drop policy if exists products_public_read on products;
create policy products_public_read on products for select using (active = true);

drop policy if exists plans_public_read on plans;
create policy plans_public_read on plans for select using (active = true);

revoke insert, update, delete on products, plans, product_tracks, orders, order_items,
  payments, payment_events, refunds, entitlements, subscription_events, audit_log
  from anon, authenticated;

grant select on products, plans, product_tracks to anon, authenticated;
