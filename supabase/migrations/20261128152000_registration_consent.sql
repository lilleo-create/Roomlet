begin;
-- Null during closed testing: no documents, no required or invented consent.
alter table public.workshop_settings add column registration_documents jsonb;
create table roomlet_private.registration_consents (
  user_id uuid primary key references auth.users(id),
  documents jsonb not null,
  accepted_at timestamptz not null default clock_timestamp()
);
alter table roomlet_private.registration_consents enable row level security;
revoke all on roomlet_private.registration_consents from public,anon,authenticated;
create function roomlet_private.registration_documents() returns jsonb
language sql stable security definer set search_path='' as $$
  select case when registration_documents->>'enabled'='true' then registration_documents else null end
    from public.workshop_settings where id=1
$$;
create function public.roomlet_registration_documents() returns jsonb
language sql stable security invoker set search_path='' as $$select roomlet_private.registration_documents()$$;
revoke all on function roomlet_private.registration_documents(),public.roomlet_registration_documents() from public;
grant execute on function roomlet_private.registration_documents(),public.roomlet_registration_documents() to anon,authenticated;
-- Atomic audit at signup, using database time. Metadata is an acceptance claim,
-- never a source of privileges. Subsequent metadata edits cannot rewrite it.
create function roomlet_private.record_registration_consent() returns trigger
language plpgsql security definer set search_path='' as $$
declare docs jsonb; claim jsonb;
begin
  docs:=roomlet_private.registration_documents();
  if docs is null or coalesce(new.email,'')='' then return new; end if;
  claim:=to_jsonb(new)->'raw_user_meta_data'->'registration_consent';
  if coalesce(claim->>'accepted','')<>'true'
    or coalesce(docs->'privacy'->>'version','')=''
    or coalesce(docs->'consent'->>'version','')=''
    or coalesce(docs->'privacy'->>'url','') !~ '^https://'
    or coalesce(docs->'consent'->>'url','') !~ '^https://'
    or (claim->>'privacy_version') is distinct from (docs->'privacy'->>'version')
    or (claim->>'consent_version') is distinct from (docs->'consent'->>'version') then
    raise exception 'Current registration consent required' using errcode='23514';
  end if;
  insert into roomlet_private.registration_consents(user_id,documents) values(new.id,docs);
  return new;
end $$;
revoke all on function roomlet_private.record_registration_consent() from public,anon,authenticated;
create trigger roomlet_registration_consent after insert on auth.users
for each row execute function roomlet_private.record_registration_consent();
commit;
