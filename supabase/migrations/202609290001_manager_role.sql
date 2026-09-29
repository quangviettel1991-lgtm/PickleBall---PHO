-- Add a restricted manager role without changing any club data or existing accounts.
-- Grant this role only to a specific, separately authenticated user after deployment.
begin;
insert into club_private.pre_migration_backup(original_row)
select to_jsonb(c) from public.pickleball_club c where c.id=1;

alter table club_private.memberships drop constraint if exists memberships_role_check;
alter table club_private.memberships add constraint memberships_role_check
  check(role in ('admin','viewer','manager'));

create or replace function public.club_read(p_club_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; my_role text;
begin
  my_role:=public.club_my_role(p_club_id);
  if my_role is distinct from 'admin' and my_role is distinct from 'manager' then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select jsonb_build_object(
    'data',case when my_role='manager' then jsonb_set(c.data,'{transactions}','[]'::jsonb,true) else c.data end,
    'revision',c.revision,'updated_at',c.updated_at) into result
  from public.pickleball_club c where c.id=p_club_id;
  return result;
end $$;

create or replace function public.club_save(p_club_id bigint, p_expected_revision bigint, p_data jsonb, p_operation_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.pickleball_club%rowtype; prior club_private.operations%rowtype;
  next_revision bigint; my_role text; effective_data jsonb;
begin
  my_role:=public.club_my_role(p_club_id);
  if my_role is distinct from 'admin' and my_role is distinct from 'manager' then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_operation_id is null or length(p_operation_id)>160 then raise exception 'Invalid operation'; end if;
  select * into current_row from public.pickleball_club where id=p_club_id for update;
  if not found then raise exception 'Club must be provisioned explicitly'; end if;
  select * into prior from club_private.operations where club_id=p_club_id and operation_id=p_operation_id;
  if found then
    if prior.actor<>auth.uid() or prior.payload is distinct from p_data then raise exception 'Operation ID reuse'; end if;
    return jsonb_build_object('revision',prior.revision,'alreadySaved',true);
  end if;
  if p_expected_revision is distinct from current_row.revision then
    return jsonb_build_object('conflict',true,'current',jsonb_build_object(
      'data',case when my_role='manager' then jsonb_set(current_row.data,'{transactions}','[]'::jsonb,true) else current_row.data end,
      'revision',current_row.revision));
  end if;
  if my_role='manager' then
    if p_data->'transactions' is distinct from '[]'::jsonb then
      raise exception 'Forbidden financial change' using errcode='42501';
    end if;
    effective_data:=jsonb_set(p_data,'{transactions}',coalesce(current_row.data->'transactions','[]'::jsonb),true);
  else
    effective_data:=p_data;
  end if;
  perform club_private.validate_payload(effective_data,current_row.data);
  insert into club_private.history(club_id,revision,actor,data) values(p_club_id,current_row.revision,auth.uid(),current_row.data);
  next_revision:=current_row.revision+1;
  update public.pickleball_club set data=effective_data,revision=next_revision,updated_at=clock_timestamp() where id=p_club_id;
  insert into club_private.operations(club_id,operation_id,actor,payload,revision)
    values(p_club_id,p_operation_id,auth.uid(),p_data,next_revision);
  return jsonb_build_object('revision',next_revision);
end $$;
commit;
