-- Run in a maintenance window after exporting remote-row.json and deploying the matching client.
-- Transactional, additive migration: never delete or overwrite existing club JSON.
begin;
create schema if not exists club_private;
revoke all on schema club_private from public, anon, authenticated;

create table if not exists club_private.pre_migration_backup (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default now(),
  original_row jsonb not null
);
insert into club_private.pre_migration_backup(original_row)
select to_jsonb(c) from public.pickleball_club c;

alter table public.pickleball_club add column if not exists revision bigint not null default 0;
create table if not exists club_private.memberships (
  club_id bigint not null,
  user_id uuid not null references auth.users(id),
  role text not null check(role in ('admin','viewer')),
  primary key(club_id, user_id)
);
-- Refuse to change public access unless the intended owner can administer club 1.
-- This runs in the same transaction as the policy replacement.
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email)='amaquangvp@gmail.com';
  if owner_id is null then raise exception 'Create the owner account in Supabase Auth first'; end if;
  if not exists(select 1 from public.pickleball_club where id=1) then raise exception 'Club 1 not found'; end if;
  insert into club_private.memberships(club_id,user_id,role) values(1,owner_id,'admin')
    on conflict(club_id,user_id) do update set role='admin';
end $$;
create table if not exists club_private.history (
  id bigint generated always as identity primary key,
  club_id bigint not null,
  revision bigint not null,
  captured_at timestamptz not null default now(),
  actor uuid,
  data jsonb not null
);
create table if not exists club_private.operations (
  club_id bigint not null,
  operation_id text not null,
  actor uuid not null,
  payload jsonb not null,
  revision bigint not null,
  primary key(club_id, operation_id)
);
alter table club_private.pre_migration_backup enable row level security;
alter table club_private.memberships enable row level security;
alter table club_private.history enable row level security;
alter table club_private.operations enable row level security;
revoke all on all tables in schema club_private from public, anon, authenticated;

create or replace function public.club_my_role(p_club_id bigint)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from club_private.memberships m where m.club_id=p_club_id and m.user_id=auth.uid()
$$;

create or replace function public.club_read(p_club_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if public.club_my_role(p_club_id) is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  select jsonb_build_object('data', c.data, 'revision', c.revision, 'updated_at', c.updated_at) into result
    from public.pickleball_club c where c.id=p_club_id;
  return result;
end $$;

create or replace function public.club_public_read(p_club_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object('revision', c.revision, 'data', jsonb_build_object(
  'schemaVersion',2,
  'members', coalesce((select jsonb_agg(jsonb_build_object(
    'id',m->'id','name',m->'name','elo',m->'elo','eloSingles',coalesce(m->'eloSingles', '1000'::jsonb),
    'eloDoubles',coalesce(m->'eloDoubles',m->'elo'),'avatarColor',m->'avatarColor','isGuest',coalesce(m->'isGuest','false'::jsonb),
    'archivedAt',m->'archivedAt')) from jsonb_array_elements(c.data->'members') m), '[]'::jsonb),
  'events', coalesce((select jsonb_agg(jsonb_build_object('id',e->'id','name',e->'name','date',e->'date','isLocked',e->'isLocked'))
    from jsonb_array_elements(c.data->'events') e),'[]'::jsonb),
  'matches', coalesce((select jsonb_agg(jsonb_build_object('id',m->'id','eventId',m->'eventId','type',m->'type','date',m->'date',
    'teamA',m->'teamA','teamB',m->'teamB','scoreA',m->'scoreA','scoreB',m->'scoreB','sets',coalesce(m->'sets','[]'::jsonb),
    'played',coalesce(m->'played','true'::jsonb),'eloChanges',coalesce(m->'eloChanges','{}'::jsonb)))
    from jsonb_array_elements(c.data->'matches') m),'[]'::jsonb),
  'transactions','[]'::jsonb,'draws','{}'::jsonb))
from public.pickleball_club c where c.id=p_club_id
$$;

create or replace function club_private.validate_payload(p_data jsonb, p_old jsonb)
returns void language plpgsql set search_path = '' as $$
declare collection text; row_data jsonb; locked_event jsonb; item jsonb;
begin
  if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>8388608 then raise exception 'Invalid or oversized payload'; end if;
  if p_data->>'schemaVersion' is distinct from '2' then raise exception 'Unsupported schema'; end if;
  if jsonb_typeof(p_data->'draws') is distinct from 'object' then raise exception 'Invalid bracket data'; end if;
  foreach collection in array array['members','events','matches','transactions'] loop
    if jsonb_typeof(p_data->collection) is distinct from 'array' then raise exception 'Invalid collection %', collection; end if;
    if exists(select 1 from jsonb_array_elements(p_data->collection) x where jsonb_typeof(x) is distinct from 'object' or nullif(x->>'id','') is null)
      or (select count(*) from jsonb_array_elements(p_data->collection)) <> (select count(distinct x->>'id') from jsonb_array_elements(p_data->collection) x)
      then raise exception 'Missing or duplicate IDs'; end if;
  end loop;
  for row_data in select * from jsonb_array_elements(p_data->'members') loop
    if jsonb_typeof(row_data->'name') is distinct from 'string' or nullif(btrim(row_data->>'name'),'') is null or length(row_data->>'name')>300 then raise exception 'Member name required'; end if;
  end loop;
  for row_data in select * from jsonb_array_elements(p_data->'transactions') loop
    -- Unchanged legacy rows are retained; newly written amounts must be valid VND integers.
    if exists(select 1 from jsonb_array_elements(coalesce(p_old->'transactions','[]')) x where x=row_data) then continue; end if;
    if coalesce(row_data->>'type','') not in ('income','expense') or jsonb_typeof(row_data->'amount') is distinct from 'number' or coalesce(row_data->>'amount','') !~ '^[1-9][0-9]*$'
      or (row_data->>'amount')::numeric>9007199254740991 then raise exception 'Invalid transaction'; end if;
  end loop;
  for row_data in select * from jsonb_array_elements(p_data->'matches') loop
    if exists(select 1 from jsonb_array_elements(coalesce(p_old->'matches','[]')) x where x=row_data) then continue; end if;
    if coalesce(row_data->>'type','') not in ('singles','doubles') or jsonb_typeof(row_data->'teamA') is distinct from 'array'
      or jsonb_typeof(row_data->'teamB') is distinct from 'array' then raise exception 'Invalid teams'; end if;
    if coalesce((row_data->>'played')::boolean,true) then
      if jsonb_typeof(row_data->'scoreA') is distinct from 'number' or jsonb_typeof(row_data->'scoreB') is distinct from 'number'
        or coalesce(row_data->>'scoreA','') !~ '^[0-9]+$' or coalesce(row_data->>'scoreB','') !~ '^[0-9]+$'
        or (row_data->>'scoreA')::numeric>999 or (row_data->>'scoreB')::numeric>999
        or (row_data->>'scoreA')::numeric=(row_data->>'scoreB')::numeric then raise exception 'Invalid score'; end if;
      if jsonb_array_length(row_data->'teamA') <> (case when row_data->>'type'='singles' then 1 else 2 end)
        or jsonb_array_length(row_data->'teamB') <> (case when row_data->>'type'='singles' then 1 else 2 end)
        then raise exception 'Incomplete teams'; end if;
      if (select count(distinct value) from jsonb_array_elements((row_data->'teamA') || (row_data->'teamB'))) <>
        jsonb_array_length(row_data->'teamA')+jsonb_array_length(row_data->'teamB') then raise exception 'Duplicate players'; end if;
    end if;
  end loop;
  for locked_event in select * from jsonb_array_elements(coalesce(p_old->'events','[]')) e where e->>'isLocked'='true' loop
    -- Unlock is a separate operation. Scores cannot change in the same save as unlocking.
    if not exists(select 1 from jsonb_array_elements(p_data->'events') e where e->>'id'=locked_event->>'id') then raise exception 'Locked event'; end if;
    if (select coalesce(jsonb_agg(m || jsonb_build_object('played',coalesce(m->'played',to_jsonb((m->>'scoreA')::numeric<>(m->>'scoreB')::numeric)), 'sets',coalesce(m->'sets','[]'::jsonb), 'eloChanges',coalesce(m->'eloChanges','{}'::jsonb)) order by m->>'id'),'[]') from jsonb_array_elements(p_old->'matches') m where m->>'eventId'=locked_event->>'id')
      is distinct from (select coalesce(jsonb_agg(m || jsonb_build_object('played',coalesce(m->'played',to_jsonb((m->>'scoreA')::numeric<>(m->>'scoreB')::numeric)), 'sets',coalesce(m->'sets','[]'::jsonb), 'eloChanges',coalesce(m->'eloChanges','{}'::jsonb)) order by m->>'id'),'[]') from jsonb_array_elements(p_data->'matches') m where m->>'eventId'=locked_event->>'id')
      then raise exception 'Locked event matches'; end if;
    select e into item from jsonb_array_elements(p_data->'events') e where e->>'id'=locked_event->>'id';
    if ((item-'isLocked') || jsonb_build_object('description',coalesce(item->'description','""'::jsonb))) is distinct from
      ((locked_event-'isLocked') || jsonb_build_object('description',coalesce(locked_event->'description','""'::jsonb))) then raise exception 'Locked event details'; end if;
    if (p_data->'draws'->(locked_event->>'id')) is distinct from (p_old->'draws'->(locked_event->>'id')) then raise exception 'Locked event bracket'; end if;
  end loop;
end $$;

create or replace function public.club_save(p_club_id bigint, p_expected_revision bigint, p_data jsonb, p_operation_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.pickleball_club%rowtype; prior club_private.operations%rowtype; next_revision bigint;
begin
  if public.club_my_role(p_club_id) is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_operation_id is null or length(p_operation_id)>160 then raise exception 'Invalid operation'; end if;
  select * into current_row from public.pickleball_club where id=p_club_id for update;
  if not found then raise exception 'Club must be provisioned explicitly'; end if;
  select * into prior from club_private.operations where club_id=p_club_id and operation_id=p_operation_id;
  if found then
    if prior.actor<>auth.uid() or prior.payload is distinct from p_data then raise exception 'Operation ID reuse'; end if;
    return jsonb_build_object('revision',prior.revision,'alreadySaved',true);
  end if;
  if p_expected_revision is distinct from current_row.revision then
    return jsonb_build_object('conflict',true,'current',jsonb_build_object('data',current_row.data,'revision',current_row.revision));
  end if;
  perform club_private.validate_payload(p_data,current_row.data);
  insert into club_private.history(club_id,revision,actor,data) values(p_club_id,current_row.revision,auth.uid(),current_row.data);
  next_revision := current_row.revision+1;
  update public.pickleball_club set data=p_data, revision=next_revision, updated_at=clock_timestamp() where id=p_club_id;
  insert into club_private.operations(club_id,operation_id,actor,payload,revision) values(p_club_id,p_operation_id,auth.uid(),p_data,next_revision);
  return jsonb_build_object('revision',next_revision);
end $$;

-- Old anonymous/direct writers must be denied or they could bypass revision checks.
alter table public.pickleball_club enable row level security;
revoke all on public.pickleball_club from anon, authenticated;
grant select on public.pickleball_club to authenticated;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='pickleball_club' loop
    execute format('drop policy %I on public.pickleball_club',p.policyname);
  end loop;
end $$;
create policy club_admin_read on public.pickleball_club for select to authenticated using(public.club_my_role(id)='admin');
revoke all on function public.club_my_role(bigint) from public, anon;
revoke all on function public.club_read(bigint) from public, anon;
revoke all on function public.club_save(bigint,bigint,jsonb,text) from public, anon;
revoke all on function public.club_public_read(bigint) from public;
grant execute on function public.club_my_role(bigint), public.club_read(bigint), public.club_save(bigint,bigint,jsonb,text) to authenticated;
grant execute on function public.club_public_read(bigint) to anon, authenticated;
revoke all on function club_private.validate_payload(jsonb,jsonb) from public, anon, authenticated;
commit;
