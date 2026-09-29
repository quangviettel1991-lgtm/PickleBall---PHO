-- Run only after the owner has created and confirmed the dedicated Auth account.
-- This grants club 1 manager access while the server keeps finance data private.
begin;
do $$
declare manager_id uuid; owner_id uuid;
begin
  select id into manager_id from auth.users
  where lower(email)='amaquangvp+phoquanly@gmail.com' and email_confirmed_at is not null;
  select id into owner_id from auth.users where lower(email)='amaquangvp@gmail.com';
  if manager_id is null then raise exception 'Confirmed manager account not found'; end if;
  if manager_id=owner_id then raise exception 'Manager must be a separate account'; end if;
  insert into club_private.memberships(club_id,user_id,role)
  values(1,manager_id,'manager')
  on conflict(club_id,user_id) do update set role='manager';
end $$;
commit;
