create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  order_updates boolean not null default false,
  marketing_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated;
grant select, insert(profile_id, order_updates, marketing_opt_in),
  update(order_updates, marketing_opt_in) on public.notification_preferences to authenticated;
create policy own_preferences on public.notification_preferences to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create trigger preference_timestamp before update on public.notification_preferences
  for each row execute function roomlet_private.touch_updated_at();

create table roomlet_private.marketing_consent_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  opted_in boolean not null,
  consent_version text not null,
  recorded_at timestamptz not null default now()
);
create index consent_events_by_profile on roomlet_private.marketing_consent_events(profile_id, recorded_at);
alter table roomlet_private.marketing_consent_events enable row level security;
revoke all on roomlet_private.marketing_consent_events from public, anon, authenticated;

create function roomlet_private.record_marketing_choice() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.marketing_opt_in)
    or (tg_op = 'UPDATE' and new.marketing_opt_in is distinct from old.marketing_opt_in) then
    insert into roomlet_private.marketing_consent_events(profile_id, opted_in, consent_version)
    values (new.profile_id, new.marketing_opt_in, 'workshop-news-email-v1');
  end if;
  return new;
end;
$$;
revoke all on function roomlet_private.record_marketing_choice() from public, anon, authenticated;
create trigger record_marketing_choice after insert or update of marketing_opt_in on public.notification_preferences
  for each row execute function roomlet_private.record_marketing_choice();

create function public.save_notification_preferences(p_order_updates boolean, p_marketing_opt_in boolean)
returns void language sql security invoker set search_path = '' as $$
  insert into public.notification_preferences(profile_id, order_updates, marketing_opt_in)
  values ((select auth.uid()), p_order_updates, p_marketing_opt_in)
  on conflict (profile_id) do update set
    order_updates = excluded.order_updates, marketing_opt_in = excluded.marketing_opt_in;
$$;
revoke all on function public.save_notification_preferences(boolean, boolean) from public, anon, authenticated;
grant execute on function public.save_notification_preferences(boolean, boolean) to authenticated;
