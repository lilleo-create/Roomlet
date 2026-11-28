begin;

-- Contact information is deliberately separate from Auth login credentials.
alter table public.profiles
  add column contact_email text,
  add column contact_phone text,
  add constraint profile_contact_email check (contact_email is null or
    (char_length(contact_email) <= 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  add constraint profile_contact_phone check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{6,14}$');
grant update(contact_email,contact_phone) on public.profiles to authenticated;

create function roomlet_private.find_team_account(p_identifier text)
returns table(user_id uuid, email text, display_name text, member_role text, telegram_id text, telegram_username text)
language plpgsql security definer set search_path = '' as $$
begin
  perform roomlet_private.require_owner();
  if char_length(p_identifier)>254 then return; end if;
  return query select p.id, case when u.email_confirmed_at is not null then u.email::text end,
    coalesce(nullif(p.display_name,''),i.identity_data->>'name',''),p.role,
    substring(i.provider_id from '^tg:([0-9]+)$'),i.identity_data->>'preferred_username'
  from public.profiles p join auth.users u on u.id=p.id
  left join auth.identities i on i.user_id=p.id and i.provider='custom:roomlet-telegram'
  where p.id::text=lower(btrim(p_identifier)) or i.provider_id='tg:'||btrim(p_identifier)
    or (u.email_confirmed_at is not null and lower(u.email)=lower(btrim(p_identifier)))
  order by p.id;
end $$;

create function roomlet_private.grant_maker_by_id(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform roomlet_private.require_owner();
  perform id from auth.users where id=p_user_id and (banned_until is null or banned_until<now()) for share;
  if not found then raise exception 'Account unavailable' using errcode='P0002'; end if;
  update public.profiles set role='maker' where id=p_user_id and role in ('maker','customer');
  if not found then raise exception 'Owner roles cannot be changed from Studio' using errcode='42501'; end if;
end $$;

create or replace function roomlet_private.team_members()
returns table(user_id uuid, email text, display_name text, member_role text)
language plpgsql security definer set search_path = '' as $$
begin
  perform roomlet_private.require_owner();
  return query select p.id,u.email::text,
    coalesce(nullif(p.display_name,''),(select i.identity_data->>'name' from auth.identities i
      where i.user_id=p.id and i.provider='custom:roomlet-telegram' limit 1),''),p.role
    from public.profiles p join auth.users u on u.id=p.id
    where p.role in ('owner','maker') order by (p.role='owner') desc,p.display_name,p.id;
end $$;

create function public.roomlet_find_team_account(p_identifier text)
returns table(user_id uuid, email text, display_name text, member_role text, telegram_id text, telegram_username text)
language sql security invoker set search_path='' as $$ select * from roomlet_private.find_team_account(p_identifier) $$;
create function public.roomlet_grant_maker_by_id(p_user_id uuid) returns void
language sql security invoker set search_path='' as $$ select roomlet_private.grant_maker_by_id(p_user_id) $$;
revoke all on function roomlet_private.find_team_account(text),roomlet_private.grant_maker_by_id(uuid),
  public.roomlet_find_team_account(text),public.roomlet_grant_maker_by_id(uuid) from public,anon,authenticated;
grant execute on function roomlet_private.find_team_account(text),roomlet_private.grant_maker_by_id(uuid),
  public.roomlet_find_team_account(text),public.roomlet_grant_maker_by_id(uuid) to authenticated;
commit;
