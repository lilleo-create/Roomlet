begin;
create table roomlet_private.telegram_launches (
  proof_hash text primary key check (proof_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null
);
create index telegram_launch_expiry on roomlet_private.telegram_launches(expires_at);
alter table roomlet_private.telegram_launches enable row level security;
revoke all on roomlet_private.telegram_launches from public, anon, authenticated;
-- Only the backend verifies Telegram's signature. Never expose a redemption oracle.
create function public.consume_telegram_launch(proof_hash text, valid_until timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if valid_until <= clock_timestamp() or valid_until > clock_timestamp() + interval '6 minutes' then
    return false;
  end if;
  delete from roomlet_private.telegram_launches where expires_at <= clock_timestamp();
  insert into roomlet_private.telegram_launches values (proof_hash, valid_until)
    on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.consume_telegram_launch(text,timestamptz) from public, anon, authenticated;
grant execute on function public.consume_telegram_launch(text,timestamptz) to service_role;
commit;
