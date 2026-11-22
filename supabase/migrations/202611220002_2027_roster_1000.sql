-- Keep the 2026 archive intact. Trim only the 2027 roster after taking a full
-- row snapshot, and preserve the current finance ledger even if it changed
-- after the original season import.
begin;
do $$
declare
  current_row public.pickleball_club%rowtype;
  kept_members jsonb;
  next_data jsonb;
  guest_count integer;
  named_count integer;
begin
  select * into current_row from public.pickleball_club where id=3 for update;
  if not found or current_row.data->>'season' is distinct from '2027' then
    raise exception '2027 club not found';
  end if;
  if jsonb_array_length(current_row.data->'members') <> 22
    or jsonb_array_length(current_row.data->'events') <> 0
    or jsonb_array_length(current_row.data->'matches') <> 0
    or current_row.data->'draws' <> '{}'::jsonb then
    raise exception '2027 sports data changed; review before trimming roster';
  end if;

  select count(*) filter (where member->>'isGuest'='true'),
         count(*) filter (where member->>'name'='Nam tay phải'
                           and member->>'isGuest'='false')
    into guest_count, named_count
    from jsonb_array_elements(current_row.data->'members') member;
  if guest_count <> 12 or named_count <> 1 then
    raise exception 'Guest or Nam tay phải roster differs from reviewed data';
  end if;

  select coalesce(jsonb_agg(member || jsonb_build_object(
      'elo',1000,'eloSingles',1000,'eloDoubles',1000,
      'initialElo',1000,'initialEloSingles',1000,'initialEloDoubles',1000)
      order by ordinal), '[]'::jsonb)
    into kept_members
    from jsonb_array_elements(current_row.data->'members')
      with ordinality as source(member,ordinal)
    where member->>'isGuest' is distinct from 'true'
      and member->>'name'<>'Nam tay phải';
  if jsonb_array_length(kept_members) <> 9 then
    raise exception 'Unexpected retained member count';
  end if;

  next_data := jsonb_set(current_row.data - 'legacyDrawStorage',
                         '{members}', kept_members);
  perform club_private.validate_payload(next_data,current_row.data);
  insert into club_private.pre_migration_backup(original_row)
    values(to_jsonb(current_row));
  insert into club_private.history(club_id,revision,actor,data)
    values(3,current_row.revision,null,current_row.data);
  update public.pickleball_club
    set data=next_data,revision=current_row.revision+1,
        updated_at=clock_timestamp()
    where id=3;

  if (select data->'transactions' from public.pickleball_club where id=3)
      is distinct from current_row.data->'transactions' then
    raise exception 'Finance ledger changed during roster update';
  end if;
end $$;
commit;
