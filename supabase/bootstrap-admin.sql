-- First create the account amaquangvp@gmail.com in Supabase Auth with a private password.
-- This script does not send email or create a password. Club ID 1 matches current configuration;
-- verify it against VITE_CLUB_ID before execution.
begin;
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email)='amaquangvp@gmail.com';
  if owner_id is null then raise exception 'Create the owner account in Supabase Auth first'; end if;
  if not exists(select 1 from public.pickleball_club where id=1) then raise exception 'Club 1 not found'; end if;
  insert into club_private.memberships(club_id,user_id,role) values(1,owner_id,'admin')
    on conflict(club_id,user_id) do update set role='admin';
end $$;
commit;
