-- Run once on the chosen project after verifying club id 3 is unused.
-- Creates a separate 2027 sports dataset. Club 1 (2026) remains unchanged.
-- The finance ledger is copied forward, while Elo, matches, events and draws start fresh.
begin;
do $$
declare old_data jsonb; next_data jsonb; owner_id uuid;
begin
  select data into old_data from public.pickleball_club where id=1 for share;
  if old_data is null then raise exception 'Source club 1 not found'; end if;
  if exists(select 1 from public.pickleball_club where id=3) then raise exception 'Target club 3 is already occupied'; end if;
  select user_id into owner_id from club_private.memberships where club_id=1 and role='admin' limit 1;
  if owner_id is null then raise exception 'Source club has no administrator'; end if;

  insert into club_private.pre_migration_backup(original_row)
    select to_jsonb(c) from public.pickleball_club c where c.id=1;

  select old_data || jsonb_build_object(
    'members',coalesce(jsonb_agg(member || jsonb_build_object(
      'elo',1200,'eloSingles',1000,'eloDoubles',1200,
    'initialElo',1200,'initialEloSingles',1000,'initialEloDoubles',1200) order by ordinal), '[]'::jsonb),
    'events','[]'::jsonb,'matches','[]'::jsonb,'draws','{}'::jsonb,
    'season','2027') into next_data
  from jsonb_array_elements(old_data->'members') with ordinality as source(member, ordinal);
  perform club_private.validate_payload(next_data, next_data);
  insert into public.pickleball_club(id,data,revision,updated_at)
    values(3,next_data,0,clock_timestamp());
  insert into club_private.memberships(club_id,user_id,role)
    select 3,user_id,role from club_private.memberships
    where club_id=1 and role in ('admin','manager');
end $$;
commit;
