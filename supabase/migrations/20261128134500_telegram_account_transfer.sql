begin;
-- The broker is the sole caller: fresh password authentication + verified Telegram
-- proof + explicit transfer consent. No identity/name matching or role promotion.
create table roomlet_private.telegram_account_transfers (
  source_id uuid primary key references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  telegram_id text not null unique,
  proof_hash text not null unique,
  previous_data jsonb not null,
  transferred_at timestamptz not null default now(),
  check(source_id<>target_id)
);
alter table roomlet_private.telegram_account_transfers enable row level security;
revoke all on roomlet_private.telegram_account_transfers from public,anon,authenticated;

create function roomlet_private.transfer_telegram(p_target uuid,p_telegram_id text,p_proof_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  source uuid;
  identity_id uuid;
  snapshot jsonb;
begin
  if p_telegram_id !~ '^[1-9][0-9]{0,15}$' or p_proof_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid proof' using errcode='42501';
  end if;
  -- Serialize transfers, then lock both profiles and the provider identity.
  perform pg_advisory_xact_lock(hashtextextended('roomlet-telegram-transfer',0));
  if not exists(select 1 from roomlet_private.telegram_launches where proof_hash=p_proof_hash and expires_at>clock_timestamp())
    or exists(select 1 from roomlet_private.telegram_account_transfers where proof_hash=p_proof_hash) then
    raise exception 'Fresh consumed proof required' using errcode='42501';
  end if;
  select i.user_id,i.id into source,identity_id from auth.identities i
    where i.provider='custom:roomlet-telegram' and i.provider_id='tg:'||p_telegram_id for update;
  if source is null then return false; end if;
  if source=p_target then return true; end if;
  perform id from public.profiles where id in (source,p_target) order by id for update;
  perform id from auth.users where id in (source,p_target) order by id for update;
  if not exists(select 1 from auth.users where id=p_target and email is not null and email<>'' and email_confirmed_at is not null
      and (banned_until is null or banned_until<now()))
    or not exists(select 1 from public.profiles where id=source and role='customer')
    or exists(select 1 from roomlet_private.telegram_account_transfers where source_id in (source,p_target))
    or exists(select 1 from auth.users where id=source and coalesce(email,'')<>'')
    or (select count(*) from auth.identities where user_id=source)<>1
    or exists(select 1 from auth.identities where user_id=p_target and provider='custom:roomlet-telegram') then
    raise exception 'Account cannot be transferred' using errcode='42501';
  end if;
  select jsonb_build_object('source_profile',to_jsonb(p),'target_profile',(select to_jsonb(t) from public.profiles t where t.id=p_target),
    'source_auth_metadata',(select raw_app_meta_data from auth.users where id=source),
    'target_auth_metadata',(select raw_app_meta_data from auth.users where id=p_target),
    'identity',(select to_jsonb(i) from auth.identities i where i.id=identity_id),
    'orders',coalesce((select jsonb_agg(id) from public.orders where customer_id=source),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(id) from public.custom_requests where customer_id=source),'[]'::jsonb))
    into snapshot from public.profiles p where p.id=source;
  insert into roomlet_private.telegram_account_transfers(source_id,target_id,telegram_id,proof_hash,previous_data)
    values(source,p_target,p_telegram_id,p_proof_hash,snapshot);
  update public.orders set customer_id=p_target where customer_id=source;
  update public.custom_requests set customer_id=p_target where customer_id=source;
  update public.profiles t set
    contact_email=coalesce(t.contact_email,s.contact_email),contact_phone=coalesce(t.contact_phone,s.contact_phone),
    display_name=coalesce(nullif(t.display_name,''),s.display_name)
    from public.profiles s where s.id=source and t.id=p_target;
  -- Keep existing target choices; do not manufacture marketing consent.
  insert into public.notification_preferences(profile_id,order_updates,marketing_opt_in)
    select p_target,order_updates,false from public.notification_preferences where profile_id=source
    on conflict(profile_id) do nothing;
  update auth.identities set user_id=p_target,updated_at=now() where id=identity_id;
  update auth.users u set raw_app_meta_data=jsonb_set(coalesce(u.raw_app_meta_data,'{}'::jsonb),'{providers}',
    coalesce((select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id=u.id),'[]'::jsonb))
    where u.id in (source,p_target);
  update auth.refresh_tokens set revoked=true where user_id=source::text;
  delete from auth.sessions where user_id=source;
  -- Retain the source account and its historical records, but prohibit new sign-ins.
  update auth.users set banned_until='infinity'::timestamptz where id=source;
  return true;
end $$;
create function public.roomlet_transfer_telegram(p_target uuid,p_telegram_id text,p_proof_hash text)
returns boolean language sql security invoker set search_path='' as $$
  select roomlet_private.transfer_telegram(p_target,p_telegram_id,p_proof_hash)
$$;
create function roomlet_private.telegram_account_merged(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from roomlet_private.telegram_account_transfers where source_id=p_user_id)
$$;
create function public.roomlet_telegram_account_merged(p_user_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select roomlet_private.telegram_account_merged(p_user_id)
$$;
revoke all on function roomlet_private.transfer_telegram(uuid,text,text),public.roomlet_transfer_telegram(uuid,text,text),
  roomlet_private.telegram_account_merged(uuid),public.roomlet_telegram_account_merged(uuid) from public,anon,authenticated;
grant usage on schema roomlet_private to service_role;
grant execute on function roomlet_private.transfer_telegram(uuid,text,text),public.roomlet_transfer_telegram(uuid,text,text),
  roomlet_private.telegram_account_merged(uuid),public.roomlet_telegram_account_merged(uuid) to service_role;
commit;
