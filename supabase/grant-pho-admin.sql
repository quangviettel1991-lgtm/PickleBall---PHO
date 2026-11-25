-- Run only after the dedicated Auth account has been created and confirmed.
-- Grants full application admin access to both seasons. The archived season stays read-only.
begin;
do $$
declare
  account_id uuid;
  primary_owner_id uuid;
begin
  select id into account_id from auth.users
  where lower(email) = 'vanquanghc+pho@gmail.com' and email_confirmed_at is not null;
  select user_id into primary_owner_id from club_private.memberships
  where club_id = 3 and role = 'admin' limit 1;

  if account_id is null then raise exception 'Confirmed pho Auth account not found'; end if;
  if primary_owner_id is null then raise exception 'Primary 2027 administrator not found'; end if;
  if account_id = primary_owner_id then raise exception 'pho must use a separate Auth account'; end if;
  if (select count(*) from public.pickleball_club where id in (1, 3)) <> 2 then
    raise exception 'Expected 2026 and 2027 club records';
  end if;

  insert into club_private.memberships(club_id, user_id, role)
  values (1, account_id, 'admin'), (3, account_id, 'admin')
  on conflict (club_id, user_id) do update set role = 'admin';
end $$;
commit;
