begin;
create table roomlet_private.customer_store_operations (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  operation_id uuid not null,
  sequence bigint generated always as identity,
  kind text not null check(kind in ('favorite','cart')),
  item_key text not null check(length(item_key) between 1 and 400),
  value jsonb,
  primary key(profile_id,operation_id)
);
create index customer_store_latest on roomlet_private.customer_store_operations(profile_id,kind,item_key,sequence desc);
alter table roomlet_private.customer_store_operations enable row level security;
revoke all on roomlet_private.customer_store_operations from public,anon,authenticated;

create function roomlet_private.sync_saved_items(p_operations jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); op jsonb; v jsonb; k text; result jsonb;
begin
  if owner_id is null or not roomlet_private.active_login_session()
    or not exists(select 1 from auth.users where id=owner_id and (banned_until is null or banned_until<now())) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if jsonb_typeof(p_operations)<>'array' or jsonb_array_length(p_operations)>100 then
    raise exception 'Invalid operations' using errcode='22023';
  end if;
  -- Serialize a batch for the account; retrying an operation never applies it twice.
  perform id from public.profiles where id=owner_id for update;
  for op in select value from jsonb_array_elements(p_operations) loop
    k:=op->>'key'; v:=nullif(op->'value','null'::jsonb);
    if op->>'kind' not in ('favorite','cart') or k is null or length(k) not between 1 and 400
      or coalesce(op->>'id','') !~ '^[a-fA-F0-9-]{36}$' or not(op ? 'value') then
      raise exception 'Invalid operation' using errcode='22023';
    end if;
    if op->>'kind'='favorite' and (length(k)>200 or v is not null and (jsonb_typeof(v)<>'string' or v#>>'{}'<>k)) then
      raise exception 'Invalid favorite' using errcode='22023';
    end if;
    if op->>'kind'='cart' and v is not null and (
      jsonb_typeof(v)<>'object' or (v - array['slug','mode','window'])<>'{}'::jsonb
      or coalesce(v->>'slug','')='' or length(v->>'slug')>200
      or coalesce(v->>'mode','') not in ('ready','made') or not(v ? 'window')
      or (v->>'mode'='ready' and v->'window'<>'null'::jsonb)
      or (v->>'mode'='made' and (jsonb_typeof(v->'window')<>'string' or length(v->>'window')>150))
      or k<>(v->>'slug')||':'||(v->>'mode')||':'||coalesce(v->>'window','')) then
      raise exception 'Invalid cart item' using errcode='22023';
    end if;
    insert into roomlet_private.customer_store_operations(profile_id,operation_id,kind,item_key,value)
      values(owner_id,(op->>'id')::uuid,op->>'kind',k,v) on conflict(profile_id,operation_id) do nothing;
  end loop;
  select jsonb_build_object(
    'revision',coalesce((select max(sequence)::text from roomlet_private.customer_store_operations where profile_id=owner_id),'0'),
    'favorites',coalesce(jsonb_agg(value order by item_key) filter(where kind='favorite' and value is not null),'[]'::jsonb),
    'cart',coalesce(jsonb_agg(value order by item_key) filter(where kind='cart' and value is not null),'[]'::jsonb)) into result
    from (select distinct on(kind,item_key) kind,item_key,value from roomlet_private.customer_store_operations
      where profile_id=owner_id order by kind,item_key,sequence desc) latest;
  return result;
end $$;
create function public.roomlet_sync_saved_items(p_operations jsonb default '[]') returns jsonb
language sql security invoker set search_path='' as $$ select roomlet_private.sync_saved_items(p_operations) $$;
revoke all on function roomlet_private.sync_saved_items(jsonb),public.roomlet_sync_saved_items(jsonb) from public,anon,authenticated;
grant execute on function roomlet_private.sync_saved_items(jsonb),public.roomlet_sync_saved_items(jsonb) to authenticated;

-- The existing account transfer remains atomic, now including saved items.
create function roomlet_private.transfer_saved_items() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into roomlet_private.customer_store_operations(profile_id,operation_id,kind,item_key,value)
    select new.target_id,operation_id,kind,item_key,value from (
      select distinct on(kind,item_key) operation_id,kind,item_key,value,sequence
      from roomlet_private.customer_store_operations where profile_id=new.source_id
      order by kind,item_key,sequence desc
    ) latest where value is not null order by sequence on conflict(profile_id,operation_id) do nothing;
  return new;
end $$;
revoke all on function roomlet_private.transfer_saved_items() from public,anon,authenticated;
create trigger transfer_saved_items after insert on roomlet_private.telegram_account_transfers
for each row execute function roomlet_private.transfer_saved_items();
commit;
