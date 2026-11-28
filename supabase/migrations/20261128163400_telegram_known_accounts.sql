begin;
-- Only identities that have actually been registered are recorded here. Guest
-- launches do not write this table. Keep a tombstone when an account is closed.
create table roomlet_private.telegram_known_accounts (
  subject text primary key,
  user_id uuid not null,
  creation_reported boolean not null default false
);
alter table roomlet_private.telegram_known_accounts enable row level security;
revoke all on roomlet_private.telegram_known_accounts from public,anon,authenticated;
insert into roomlet_private.telegram_known_accounts(subject,user_id,creation_reported)
  select provider_id,user_id,true from auth.identities where provider='custom:roomlet-telegram';

create function roomlet_private.remember_telegram_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_user uuid;
begin
  if new.provider<>'custom:roomlet-telegram' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('roomlet-telegram-identity:'||new.provider_id,0));
  select user_id into previous_user from roomlet_private.telegram_known_accounts where subject=new.provider_id;
  if tg_op='INSERT' and previous_user is not null and previous_user<>new.user_id then
    raise exception 'Previously registered identity cannot create another account' using errcode='42501';
  end if;
  insert into roomlet_private.telegram_known_accounts(subject,user_id,creation_reported)
    values(new.provider_id,new.user_id,exists(select 1 from auth.users where id=new.user_id and coalesce(email,'')<>''))
    on conflict(subject) do update set user_id=excluded.user_id;
  return new;
end $$;
revoke all on function roomlet_private.remember_telegram_account() from public,anon,authenticated;
create trigger roomlet_01_known_telegram before insert or update of user_id on auth.identities
for each row execute function roomlet_private.remember_telegram_account();

create function roomlet_private.claim_telegram_creation(p_telegram_id text,p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update roomlet_private.telegram_known_accounts set creation_reported=true
    where subject='tg:'||p_telegram_id and user_id=p_user and not creation_reported
      and exists(select 1 from auth.identities where provider='custom:roomlet-telegram' and provider_id='tg:'||p_telegram_id and user_id=p_user);
  return found;
end $$;
create function public.roomlet_claim_telegram_creation(p_telegram_id text,p_user uuid) returns boolean
language sql security invoker set search_path='' as $$ select roomlet_private.claim_telegram_creation(p_telegram_id,p_user) $$;
revoke all on function roomlet_private.claim_telegram_creation(text,uuid),public.roomlet_claim_telegram_creation(text,uuid) from public,anon,authenticated;
grant execute on function roomlet_private.claim_telegram_creation(text,uuid),public.roomlet_claim_telegram_creation(text,uuid) to service_role;
commit;
