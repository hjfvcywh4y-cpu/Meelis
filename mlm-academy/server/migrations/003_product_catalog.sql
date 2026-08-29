-- MLM Academy · продуктовый справочник и контракты оплаты
-- Не подключает Supabase и ЮKассу. Секреты сюда не класть.
-- Применять только как контракт схемы, не как живую миграцию без отдельного решения.

create table if not exists product_versions (
  product_code text not null,
  price_version text not null,
  display_name text not null,
  short_description text,
  buyer_segment text not null,
  billing_type text not null,
  regular_price integer,
  launch_price integer,
  access_days integer,
  publication_status text not null check (publication_status in ('planned', 'gated', 'active', 'archived')),
  launch_gate text,
  entitlement_type text,
  grant_scope text,
  sale_channel text not null default 'storefront',
  offer_version text,
  checkout_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_code, price_version)
);

comment on table product_versions is 'Цена и состав продукта определяются сервером. Клиент не может перевести продукт в active.';

alter table products add column if not exists product_code text;
alter table products add column if not exists price_version text;
alter table products add column if not exists buyer_segment text;
alter table products add column if not exists user_segment text[];
alter table products add column if not exists billing_type text;
alter table products add column if not exists regular_price integer;
alter table products add column if not exists launch_price integer;
alter table products add column if not exists access_days integer;
alter table products add column if not exists publication_status text;
alter table products add column if not exists launch_gate text;
alter table products add column if not exists entitlement_type text;
alter table products add column if not exists grant_scope text;
alter table products add column if not exists sale_channel text;
alter table products add column if not exists offer_version text;

comment on table products is 'НСИ продуктов, отдельно от каталога треков. Track ID ≠ product_code.';
comment on table product_tracks is 'Состав продукта задаёт сервер. Заказ хранит снимок, а не живую ссылку.';
comment on table orders is 'Заказ хранит снимок цены и состава. Успешный redirect не является оплатой.';
comment on table payments is 'Платёж создаётся провайдером. Повтор webhook не создаёт дубль.';
comment on table payment_events is 'Идемпотентность по provider + provider_event_id.';
comment on table refunds is 'Возврат не удаляет платёж. Право отзывается отдельно.';
comment on table entitlements is 'Право только после проверенного webhook и verified user. Tilda Members не источник права.';
comment on table audit_log is 'Журнал выдачи и отзыва прав.';

-- Подписка не реализуется в этой итерации. Таблица subscription_events остаётся контрактом статусов.
