begin;
create table roomlet_private.telegram_updates (
  update_id bigint primary key check (update_id >= 0),
  status text not null default 'claimed' check (status in ('claimed','sent','failed','uncertain')),
  received_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table roomlet_private.telegram_updates enable row level security;
revoke all on roomlet_private.telegram_updates from public, anon, authenticated;
-- Keep IDs across restarts/deploys. No message text, contact or chat ID is stored.
create function public.claim_telegram_update(event_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into roomlet_private.telegram_updates(update_id) values (event_id) on conflict do nothing;
  return found;
end;
$$;
create function public.finish_telegram_update(event_id bigint, outcome text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if outcome not in ('sent','failed','uncertain') then raise exception 'Invalid outcome'; end if;
  update roomlet_private.telegram_updates set status=outcome,finished_at=now()
    where update_id=event_id and status='claimed';
end;
$$;
revoke all on function public.claim_telegram_update(bigint) from public, anon, authenticated;
revoke all on function public.finish_telegram_update(bigint,text) from public, anon, authenticated;
grant execute on function public.claim_telegram_update(bigint) to service_role;
grant execute on function public.finish_telegram_update(bigint,text) to service_role;
commit;
