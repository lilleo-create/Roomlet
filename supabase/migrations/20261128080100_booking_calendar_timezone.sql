begin;

-- Keep public schedule dates and the workshop zone on the same database snapshot.
create function roomlet_private.booking_calendar() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'timezone', s.timezone,
    'days', (select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day, 'available_minutes', d.available_minutes
    ) order by d.day), '[]'::jsonb) from roomlet_private.availability() d)
  )
  from public.workshop_settings s where s.id = 1
$$;

create function public.roomlet_booking_calendar() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select roomlet_private.booking_calendar()
$$;

revoke all on function roomlet_private.booking_calendar(), public.roomlet_booking_calendar() from public, anon, authenticated;
grant execute on function roomlet_private.booking_calendar(), public.roomlet_booking_calendar() to anon, authenticated;

commit;
