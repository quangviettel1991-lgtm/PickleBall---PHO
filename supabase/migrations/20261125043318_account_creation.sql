-- Only the server-side Edge Function's service role may call this RPC.
-- Auth user creation happens first; this function only adds application memberships.
begin;
create or replace function public.club_admin_create_memberships(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  account_email text;
begin
  if p_role not in ('admin', 'manager') then
    raise exception 'Invalid account role' using errcode = '22023';
  end if;
  select lower(email) into account_email from auth.users
    where id = p_user_id and email_confirmed_at is not null;
  if account_email is null or account_email !~ '^vanquanghc\+[a-z][a-z0-9]{2,19}@gmail\.com$' then
    raise exception 'Expected a confirmed club account' using errcode = '22023';
  end if;
  if exists(select 1 from club_private.memberships where user_id = p_user_id) then
    raise exception 'Account already has a club role' using errcode = '23505';
  end if;
  if not exists(select 1 from public.pickleball_club where id = 3) or
     (p_role = 'admin' and not exists(select 1 from public.pickleball_club where id = 1)) then
    raise exception 'Expected club season is missing' using errcode = '22023';
  end if;

  insert into club_private.memberships(club_id, user_id, role)
  values (3, p_user_id, p_role);
  if p_role = 'admin' then
    insert into club_private.memberships(club_id, user_id, role)
    values (1, p_user_id, 'admin');
  end if;
end $$;
revoke all on function public.club_admin_create_memberships(uuid, text) from public, anon, authenticated;
grant execute on function public.club_admin_create_memberships(uuid, text) to service_role;
commit;
