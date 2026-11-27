begin;

-- Profile settings can change a display label. Database roles remain owner-managed.
grant update(display_name) on public.profiles to authenticated;
create policy edit_own_display_name on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and char_length(display_name) <= 100);

-- Lock a surviving owner before permitting removal, including cascading Auth deletions.
-- Concurrent attempts to remove each other's last owner cannot both commit.
create function roomlet_private.keep_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform id from public.profiles where role = 'owner' and id <> old.id
      order by id limit 1 for update;
    if not found then
      raise exception 'Last workshop owner must be retained' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function roomlet_private.keep_last_owner() from public, anon, authenticated;
create trigger keep_last_owner before delete or update of role on public.profiles
  for each row execute function roomlet_private.keep_last_owner();

create function roomlet_private.require_owner() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform id from public.profiles where id = (select auth.uid()) and role = 'owner' for share;
  if not found then
    raise exception 'Workshop owner required' using errcode = '42501';
  end if;
end $$;
revoke all on function roomlet_private.require_owner() from public, anon, authenticated;

create function roomlet_private.team_members()
returns table(user_id uuid, email text, display_name text, member_role text)
language plpgsql security definer set search_path = '' as $$
begin
  perform roomlet_private.require_owner();
  return query select p.id, u.email::text, p.display_name, p.role
    from public.profiles p join auth.users u on u.id = p.id
    where p.role in ('owner','maker') order by (p.role = 'owner') desc, lower(u.email), p.id;
end $$;

create function roomlet_private.grant_maker_access(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  perform roomlet_private.require_owner();
  select u.id into strict target from auth.users u
    where lower(u.email) = lower(btrim(p_email)) and u.email_confirmed_at is not null
    for share;
  update public.profiles set role = 'maker' where id = target and role in ('maker','customer');
  if not found then
    raise exception 'Owner roles cannot be changed from Studio' using errcode = '42501';
  end if;
end $$;

create function roomlet_private.revoke_maker_access(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform roomlet_private.require_owner();
  update public.profiles set role = 'customer' where id = p_user_id and role = 'maker';
  if not found then
    raise exception 'Only a maker can be removed' using errcode = '42501';
  end if;
end $$;

-- The private implementations validate auth.uid() for every call. No API role receives
-- UPDATE(role) on profiles or SELECT on auth.users.
revoke all on function roomlet_private.team_members(), roomlet_private.grant_maker_access(text),
  roomlet_private.revoke_maker_access(uuid) from public, anon, authenticated;
grant execute on function roomlet_private.team_members(), roomlet_private.grant_maker_access(text),
  roomlet_private.revoke_maker_access(uuid) to authenticated;

create function public.roomlet_team_members()
returns table(user_id uuid, email text, display_name text, member_role text)
language sql security invoker set search_path = '' as $$ select * from roomlet_private.team_members() $$;
create function public.roomlet_grant_maker(p_email text) returns void
language sql security invoker set search_path = '' as $$ select roomlet_private.grant_maker_access(p_email) $$;
create function public.roomlet_revoke_maker(p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select roomlet_private.revoke_maker_access(p_user_id) $$;

revoke all on function public.roomlet_team_members(), public.roomlet_grant_maker(text),
  public.roomlet_revoke_maker(uuid) from public, anon, authenticated;
grant execute on function public.roomlet_team_members(), public.roomlet_grant_maker(text),
  public.roomlet_revoke_maker(uuid) to authenticated;

commit;
