-- Apply after importing both seasons into the NEW Supabase project.
-- The 2026 row remains readable but cannot be changed through RPC or direct SQL.
begin;
create or replace function club_private.protect_archived_season()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.id = 1 then
    raise exception 'Season 2026 is archived and read-only' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists protect_archived_2026 on public.pickleball_club;
create trigger protect_archived_2026
before update or delete on public.pickleball_club
for each row execute function club_private.protect_archived_season();
revoke all on function club_private.protect_archived_season() from public, anon, authenticated;
commit;
