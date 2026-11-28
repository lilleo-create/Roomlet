begin;
-- Native Auth unlink remains responsible for identity/provider maintenance.
-- Its deletion transaction must also consume a server-issued fresh-proof permit.
create table roomlet_private.identity_disconnects (
  identity_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_id text not null,
  retained_identity uuid not null,
  proof_session uuid not null,
  telegram_proof text,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index identity_disconnect_user on roomlet_private.identity_disconnects(user_id);
create index identity_disconnect_provider on roomlet_private.identity_disconnects(provider,provider_id) where consumed_at is not null;
alter table roomlet_private.identity_disconnects enable row level security;
revoke all on roomlet_private.identity_disconnects from public,anon,authenticated;

create function roomlet_private.login_methods(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('email_ready',coalesce(u.email,'')<>'' and u.email_confirmed_at is not null
    and coalesce(u.encrypted_password,'')<>'' and exists(select 1 from auth.identities where user_id=u.id and provider='email'),
    'telegram_ready',exists(select 1 from auth.identities where user_id=u.id and provider='custom:roomlet-telegram'
      and provider_id ~ '^tg:[1-9][0-9]{0,15}$')) from auth.users u where u.id=p_user
$$;
create function public.roomlet_login_methods(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select roomlet_private.login_methods(p_user) $$;

create function roomlet_private.prepare_disconnect(p_user uuid,p_identity uuid,p_retained uuid,p_session uuid,p_proof text default null) returns void
language plpgsql security definer set search_path='' as $$
declare removed auth.identities; retained auth.identities; state jsonb;
begin
  perform id from auth.users where id=p_user and (banned_until is null or banned_until<now()) for update;
  if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
  select * into removed from auth.identities where id=p_identity and user_id=p_user;
  select * into retained from auth.identities where id=p_retained and user_id=p_user;
  state:=roomlet_private.login_methods(p_user);
  if removed.id is null or retained.id is null or removed.provider=retained.provider
    or removed.provider not in ('email','custom:roomlet-telegram')
    or retained.provider not in ('email','custom:roomlet-telegram')
    or not coalesce((state->>'email_ready')::boolean,false) and retained.provider='email'
    or not coalesce((state->>'telegram_ready')::boolean,false) and retained.provider='custom:roomlet-telegram'
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user
      and (retained.provider='custom:roomlet-telegram' or created_at>clock_timestamp()-interval '5 minutes'))
    or retained.provider='custom:roomlet-telegram' and not exists(select 1 from roomlet_private.telegram_launches
      where proof_hash=p_proof and expires_at>clock_timestamp()) then
    raise exception 'Fresh authentication with a working remaining method required' using errcode='42501';
  end if;
  insert into roomlet_private.identity_disconnects(identity_id,user_id,provider,provider_id,retained_identity,proof_session,telegram_proof,expires_at)
    values(removed.id,p_user,removed.provider,removed.provider_id,retained.id,p_session,p_proof,clock_timestamp()+interval '60 seconds')
    on conflict(identity_id) do update set retained_identity=excluded.retained_identity,proof_session=excluded.proof_session,
      telegram_proof=excluded.telegram_proof,expires_at=excluded.expires_at where identity_disconnects.consumed_at is null;
end $$;
create function public.roomlet_prepare_disconnect(p_user uuid,p_identity uuid,p_retained uuid,p_session uuid,p_proof text default null) returns void
language sql security invoker set search_path='' as $$ select roomlet_private.prepare_disconnect(p_user,p_identity,p_retained,p_session,p_proof) $$;

create function roomlet_private.guard_identity_disconnect() returns trigger
language plpgsql security definer set search_path='' as $$
declare permit roomlet_private.identity_disconnects; state jsonb;
begin
  -- Parent-account deletion is not a login-method change. Owner deletion keeps
  -- its existing independent last-owner safeguard.
  if old.provider not in ('email','custom:roomlet-telegram') or not exists(select 1 from auth.users where id=old.user_id)
    or not exists(select 1 from public.profiles where id=old.user_id) then return old; end if;
  perform id from auth.users where id=old.user_id for update;
  select * into permit from roomlet_private.identity_disconnects where identity_id=old.id and user_id=old.user_id
    and consumed_at is null and expires_at>clock_timestamp() for update;
  state:=roomlet_private.login_methods(old.user_id);
  if permit.identity_id is null
    or not exists(select 1 from auth.identities where id=permit.retained_identity and user_id=old.user_id
      and provider=case old.provider when 'email' then 'custom:roomlet-telegram' else 'email' end)
    or old.provider='custom:roomlet-telegram' and not coalesce((state->>'email_ready')::boolean,false)
    or old.provider='email' and not coalesce((state->>'telegram_ready')::boolean,false)
    or not exists(select 1 from auth.sessions where id=permit.proof_session and user_id=old.user_id
      and (old.provider='email' or created_at>clock_timestamp()-interval '5 minutes'))
    or old.provider='email' and not exists(select 1 from roomlet_private.telegram_launches
      where proof_hash=permit.telegram_proof and expires_at>clock_timestamp()) then
    raise exception 'Fresh authentication with a working remaining method required' using errcode='42501';
  end if;
  update roomlet_private.identity_disconnects set consumed_at=clock_timestamp() where identity_id=old.id;
  update auth.refresh_tokens set revoked=true where user_id=old.user_id::text;
  delete from auth.sessions where user_id=old.user_id;
  if old.provider='email' then
    update auth.users set email=null,email_confirmed_at=null,encrypted_password='',confirmation_token='',recovery_token='',
      email_change='',email_change_token_current='',email_change_token_new='',email_change_confirm_status=0,reauthentication_token=''
      where id=old.user_id;
    delete from auth.one_time_tokens where user_id=old.user_id;
    delete from auth.flow_state where user_id=old.user_id;
  end if;
  return old;
end $$;
create trigger roomlet_guard_identity_disconnect before delete on auth.identities
for each row execute function roomlet_private.guard_identity_disconnect();

-- Revoked JWTs must not retain private Data API / Studio access until expiry.
-- Accounts which have never detached a method keep their existing semantics.
create function roomlet_private.active_login_session() returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from roomlet_private.identity_disconnects where user_id=auth.uid() and consumed_at is not null)
    or exists(select 1 from auth.sessions where user_id=auth.uid()
      and id::text=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id'))
$$;
create or replace function roomlet_private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
  select roomlet_private.active_login_session() and exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','maker'))
$$;
create or replace function roomlet_private.require_owner() returns void
language plpgsql security definer set search_path='' as $$
begin
  if not roomlet_private.active_login_session() then raise exception 'Active session required' using errcode='42501'; end if;
  perform id from public.profiles where id=auth.uid() and role='owner' for share;
  if not found then raise exception 'Workshop owner required' using errcode='42501'; end if;
end $$;
do $$ declare target record; begin
  for target in select schemaname,tablename from pg_tables where rowsecurity
    and (schemaname='public' or schemaname='storage' and tablename='objects') loop
    execute format('create policy roomlet_live_session on %I.%I as restrictive for all to authenticated using ((select roomlet_private.active_login_session())) with check ((select roomlet_private.active_login_session()))',target.schemaname,target.tablename);
  end loop;
end $$;

create function roomlet_private.telegram_detached(p_telegram_id text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from roomlet_private.identity_disconnects where provider='custom:roomlet-telegram'
    and provider_id='tg:'||p_telegram_id and consumed_at is not null)
    and not exists(select 1 from auth.identities where provider='custom:roomlet-telegram' and provider_id='tg:'||p_telegram_id)
$$;
create function public.roomlet_telegram_detached(p_telegram_id text) returns boolean
language sql stable security invoker set search_path='' as $$ select roomlet_private.telegram_detached(p_telegram_id) $$;
revoke all on function roomlet_private.login_methods(uuid),public.roomlet_login_methods(uuid),
  roomlet_private.prepare_disconnect(uuid,uuid,uuid,uuid,text),public.roomlet_prepare_disconnect(uuid,uuid,uuid,uuid,text),
  roomlet_private.telegram_detached(text),public.roomlet_telegram_detached(text),
  roomlet_private.guard_identity_disconnect(),roomlet_private.active_login_session() from public,anon,authenticated;
grant execute on function roomlet_private.active_login_session() to authenticated;
grant execute on function roomlet_private.login_methods(uuid),public.roomlet_login_methods(uuid),
  roomlet_private.prepare_disconnect(uuid,uuid,uuid,uuid,text),public.roomlet_prepare_disconnect(uuid,uuid,uuid,uuid,text),
  roomlet_private.telegram_detached(text),public.roomlet_telegram_detached(text) to service_role;
commit;
