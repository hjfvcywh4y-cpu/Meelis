-- MLM Academy · identityLevel + RLS по auth.uid()
-- Применять в Supabase SQL editor после schema.sql.
-- Секреты в этот файл не класть. Анон-ключ не даёт права на entitlements.

alter table users add column if not exists auth_user_id uuid unique;
alter table users add column if not exists identity_level text not null default 'tilda_unverified';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_identity_level_check'
  ) then
    alter table users add constraint users_identity_level_check
      check (identity_level in ('tilda_unverified', 'verified'));
  end if;
end $$;

alter table user_routes add column if not exists session_sid text;

drop policy if exists users_auth_uid on users;
create policy users_auth_uid on users for select using (auth_user_id = auth.uid());

drop policy if exists profiles_auth_uid on profiles;
create policy profiles_auth_uid on profiles for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists entitlements_auth_uid on entitlements;
create policy entitlements_auth_uid on entitlements for select using (
  user_id in (select id from users where auth_user_id = auth.uid() and identity_level = 'verified')
);

drop policy if exists saved_auth_uid on saved_tracks;
create policy saved_auth_uid on saved_tracks for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists routes_auth_uid on user_routes;
create policy routes_auth_uid on user_routes for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists runs_auth_uid on track_runs;
create policy runs_auth_uid on track_runs for all using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists artifacts_auth_uid on artifacts;
create policy artifacts_auth_uid on artifacts for select using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

revoke insert, update, delete on entitlements from anon, authenticated;
revoke insert, update, delete on payments from anon, authenticated;
revoke insert, update, delete on orders from anon, authenticated;
