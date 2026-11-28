begin;
-- NULL: never configured, use the legacy env fallback. Empty string: intentionally disabled.
alter table public.workshop_settings add column telegram_support_username text
  check (telegram_support_username is null or telegram_support_username='' or telegram_support_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$');

create function public.roomlet_support_username() returns text
language sql stable security definer set search_path='' as $$
  select telegram_support_username from public.workshop_settings where id=1
$$;
revoke all on function public.roomlet_support_username() from public;
grant execute on function public.roomlet_support_username() to anon,authenticated;

create function public.save_workshop_support(p_username text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform roomlet_private.require_owner();
  if p_username is null or (p_username<>'' and p_username !~ '^[A-Za-z][A-Za-z0-9_]{4,31}$') then
    raise exception 'Invalid Telegram username' using errcode='22023';
  end if;
  update public.workshop_settings set telegram_support_username=p_username where id=1;
end;
$$;
revoke all on function public.save_workshop_support(text) from public,anon,authenticated;
grant execute on function public.save_workshop_support(text) to authenticated;
commit;
