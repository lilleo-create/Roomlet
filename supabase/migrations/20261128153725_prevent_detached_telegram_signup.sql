begin;
-- Serialize native identity INSERT with unlink, including a sign-in that passed
-- the broker's preliminary lookup before another request detached Telegram.
create function roomlet_private.guard_detached_telegram_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior_owner uuid; subject text;
begin
  if tg_op='DELETE' then
    if old.provider='custom:roomlet-telegram' then
      perform pg_advisory_xact_lock(hashtextextended('roomlet-telegram-identity:'||old.provider_id,0));
    end if;
    return old;
  end if;
  if new.provider<>'custom:roomlet-telegram' then return new; end if;
  subject:=new.provider_id;
  perform pg_advisory_xact_lock(hashtextextended('roomlet-telegram-identity:'||subject,0));
  select user_id into prior_owner from roomlet_private.identity_disconnects
    where provider=new.provider and provider_id=subject and consumed_at is not null
    order by consumed_at desc limit 1;
  if prior_owner is not null and prior_owner<>new.user_id then
    raise exception 'Reconnect Telegram from the existing account' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function roomlet_private.guard_detached_telegram_signup() from public,anon,authenticated;
create trigger roomlet_00_guard_telegram_owner before insert or delete on auth.identities
for each row execute function roomlet_private.guard_detached_telegram_signup();

create function roomlet_private.telegram_account(p_telegram_id text) returns uuid
language sql stable security definer set search_path='' as $$
  select user_id from auth.identities where provider='custom:roomlet-telegram' and provider_id='tg:'||p_telegram_id
$$;
create function public.roomlet_telegram_account(p_telegram_id text) returns uuid
language sql stable security invoker set search_path='' as $$ select roomlet_private.telegram_account(p_telegram_id) $$;
revoke all on function roomlet_private.telegram_account(text),public.roomlet_telegram_account(text) from public,anon,authenticated;
grant execute on function roomlet_private.telegram_account(text),public.roomlet_telegram_account(text) to service_role;
commit;
