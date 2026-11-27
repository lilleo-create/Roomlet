begin;
-- One workshop, one currency per product, integer amounts in currency minor units.
-- New objects only. Name collisions abort the migration instead of adopting existing tables.
create schema roomlet_private;
revoke all on schema roomlet_private from public;
grant usage on schema roomlet_private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('owner','maker','customer')),
  display_name text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function roomlet_private.profile_for_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end $$;
revoke all on function roomlet_private.profile_for_signup() from public, anon, authenticated;
create trigger roomlet_signup after insert on auth.users for each row execute function roomlet_private.profile_for_signup();
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

create function roomlet_private.is_staff() returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and role in ('owner','maker')) $$;
revoke all on function roomlet_private.is_staff() from public;
grant execute on function roomlet_private.is_staff() to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug)<=96 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug)<=96 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check(length(description)<=10000),
  category_id uuid references public.categories(id) on delete restrict,
  dimensions text not null default '' check(length(dimensions)<=1000),
  materials text not null default '' check(length(materials)<=1000),
  status text not null default 'draft' check(status in ('draft','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(status <> 'published' or category_id is not null)
);
create index products_category_id on public.products(category_id);
create index products_published on public.products(created_at desc,id) where status='published';
create table public.product_media (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '' check(length(alt_text)<=300),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(split_part(storage_path,'/',1)=product_id::text and storage_path ~ '^[a-f0-9-]{36}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$')
);
create index product_media_order on public.product_media(product_id,sort_order,id);
create table public.product_units (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  status text not null default 'available' check(status in ('available','reserved','sold')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index product_units_stock on public.product_units(product_id,status);
create table public.product_offers (
  product_id uuid primary key references public.products(id) on delete cascade,
  price_minor bigint not null check(price_minor between 0 and 9000000000000),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  made_to_order boolean not null, requires_sketch boolean not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost_minor bigint not null check(cost_minor between 0 and 9000000000000),
  planned_minutes integer not null check(planned_minutes between 0 and 525600),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workshop_settings (
  id integer primary key default 1 check(id=1), timezone text not null default 'UTC',
  buffer_minutes integer not null default 0 check(buffer_minutes between 0 and 1440),
  currency text not null default 'RUB' check(currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.working_hours (
  weekday integer primary key check(weekday between 1 and 7),
  minutes integer not null check(minutes between 0 and 1440),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(), start_date date not null, end_date date not null,
  reason text not null default '' check(length(reason)<=500), check (end_date>=start_date),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index blocked_periods_range on public.blocked_periods using gist (daterange(start_date,end_date,'[]'));
insert into public.workshop_settings default values;
insert into public.working_hours(weekday,minutes) select i, case when i<=5 then 480 else 0 end from generate_series(1,7) i;

create table public.orders (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'requested' check(status in ('requested','confirmed','in_progress','ready','delivered','cancelled')),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  total_minor bigint not null check(total_minor>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_customer_id on public.orders(customer_id);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  product_unit_id uuid references public.product_units(id) on delete restrict,
  title_snapshot text not null, kind text not null check(kind in ('ready','made_to_order','custom')),
  quantity integer not null check(quantity>0), unit_price_minor bigint not null check(unit_price_minor>=0),
  -- Item amounts are denominated in the immutable order currency.
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index order_items_order_id on public.order_items(order_id);
create index order_items_product_id on public.order_items(product_id);
create index order_items_unit_id on public.order_items(product_unit_id);
create table public.custom_requests (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete restrict, brief text not null,
  status text not null default 'new' check(status in ('new','review','accepted','declined','cancelled')),
  budget_minor bigint check(budget_minor>=0), currency text check(currency ~ '^[A-Z]{3}$'),
  desired_date date, check((budget_minor is null)=(currency is null)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index custom_requests_customer_id on public.custom_requests(customer_id);
create index custom_requests_order_id on public.custom_requests(order_id);
create table public.production_jobs (
  id uuid primary key default gen_random_uuid(), order_item_id uuid references public.order_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  stage text not null check(stage in ('sketch','assembly','packing','shipping')),
  status text not null default 'planned' check(status in ('planned','active','done','cancelled')),
  planned_minutes integer not null check(planned_minutes>=0), actual_minutes integer check(actual_minutes>=0),
  starts_at timestamptz, ends_at timestamptz, check(ends_at is null or (starts_at is not null and ends_at>starts_at)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index production_jobs_item_id on public.production_jobs(order_item_id);
create index production_jobs_product_id on public.production_jobs(product_id);
create index production_jobs_assigned_to on public.production_jobs(assigned_to);
create table public.production_updates (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.production_jobs(id) on delete restrict,
  body text not null, visibility text not null default 'staff' check(visibility in ('staff','customer')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index production_updates_job_id on public.production_updates(job_id);
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 96),
  properties jsonb not null default '{}' check(jsonb_typeof(properties)='object'),
  created_at timestamptz not null default now()
);
create index analytics_events_name_date on public.analytics_events(name,created_at desc);
create table public.content_drafts (
  id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id) on delete restrict,
  channel text not null default 'telegram', body text not null default '',
  status text not null default 'draft' check(status in ('draft','review','approved','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index content_drafts_product_id on public.content_drafts(product_id);

create function roomlet_private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
revoke all on function roomlet_private.touch_updated_at() from public,anon,authenticated;
do $$
declare t text;
begin
  foreach t in array array['profiles','products','product_media','categories','product_units','product_offers','product_costs','workshop_settings','working_hours','blocked_periods','orders','order_items','custom_requests','production_jobs','production_updates','analytics_events','content_drafts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
    if t <> 'profiles' then
      execute format('create policy staff_read on public.%I for select to authenticated using ((select roomlet_private.is_staff()))',t);
    else
      create policy own_profile on public.profiles for select to authenticated using (id=(select auth.uid()));
    end if;
    if t <> 'analytics_events' then
      execute format('create trigger set_updated_at before update on public.%I for each row execute function roomlet_private.touch_updated_at()',t);
    end if;
  end loop;
end $$;
grant insert(name,slug) on public.categories to authenticated;
create policy create_category on public.categories for insert to authenticated with check ((select roomlet_private.is_staff()));
grant insert(start_date,end_date,reason), update(start_date,end_date,reason),delete on public.blocked_periods to authenticated;
create policy block_dates on public.blocked_periods for insert to authenticated with check ((select roomlet_private.is_staff()));
create policy edit_block on public.blocked_periods for update to authenticated using ((select roomlet_private.is_staff())) with check ((select roomlet_private.is_staff()));
create policy remove_block on public.blocked_periods for delete to authenticated using ((select roomlet_private.is_staff()));

-- Storage metadata belongs to the Storage API. This migration provisions one
-- private bucket. Bucket collisions deliberately fail rather than changing an existing bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-media','product-media',false,5242880,array['image/webp']);
create function roomlet_private.published_file(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.product_media m join public.products p on p.id=m.product_id
    where m.storage_path=p_path and p.status='published')
$$;
create function roomlet_private.file_attached(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.product_media where storage_path=p_path)
$$;
revoke all on function roomlet_private.published_file(text),roomlet_private.file_attached(text) from public,anon,authenticated;
grant execute on function roomlet_private.published_file(text) to anon,authenticated;
grant execute on function roomlet_private.file_attached(text) to authenticated;
create policy roomlet_published_photo on storage.objects for select to anon,authenticated
  using(bucket_id='product-media' and roomlet_private.published_file(name));
create policy roomlet_staff_photo on storage.objects for select to authenticated
  using(bucket_id='product-media' and (select roomlet_private.is_staff()));
create policy roomlet_upload_photo on storage.objects for insert to authenticated with check(
  bucket_id='product-media' and (select roomlet_private.is_staff()) and
  name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'
);
create policy roomlet_remove_unattached_photo on storage.objects for delete to authenticated using (
  bucket_id='product-media' and (select roomlet_private.is_staff()) and not roomlet_private.file_attached(name)
);

create function roomlet_private.require_staff() returns void language plpgsql stable set search_path='' as $$
begin
  if not roomlet_private.is_staff() then raise exception 'Studio access required' using errcode='42501'; end if;
end $$;
revoke all on function roomlet_private.require_staff() from public,anon,authenticated;

create function roomlet_private.save_product(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare
  target uuid := coalesce(p_id,gen_random_uuid());
  status_value text := p_data->>'status';
  desired integer := (p_data->>'ready_quantity')::integer;
  current_qty integer;
  prev_version timestamptz;
  item record;
  has_media boolean;
begin
  perform roomlet_private.require_staff();
  if jsonb_typeof(p_data) is distinct from 'object' or desired is null or desired not between 0 and 1000 then
    raise exception 'Invalid product or quantity' using errcode='22023';
  end if;
  -- Serialize creates with caller-supplied ids and all edits of the same aggregate.
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select updated_at into prev_version from public.products where id=target for update;
  -- Failing on a missing row with a prior version also prevents resurrection after deletion.
  if prev_version is distinct from (p_data->>'expected_updated_at')::timestamptz then
    raise exception 'Product changed. Reload before saving.' using errcode='40001';
  end if;
  insert into public.products(id,slug,title,description,category_id,dimensions,materials,status)
  values(target,p_data->>'slug',btrim(p_data->>'title'),coalesce(p_data->>'description',''),
         (p_data->>'category_id')::uuid,coalesce(p_data->>'dimensions',''),coalesce(p_data->>'materials',''),status_value)
  on conflict (id) do update set slug=excluded.slug,title=excluded.title,description=excluded.description,
    category_id=excluded.category_id,dimensions=excluded.dimensions,materials=excluded.materials,status=excluded.status;
  insert into public.product_offers(product_id,price_minor,currency,made_to_order,requires_sketch)
  values(target,(p_data->>'price_minor')::bigint,p_data->>'currency',(p_data->>'made_to_order')::boolean,(p_data->>'requires_sketch')::boolean)
  on conflict (product_id) do update set price_minor=excluded.price_minor,currency=excluded.currency,
    made_to_order=excluded.made_to_order,requires_sketch=excluded.requires_sketch;
  insert into public.product_costs(product_id,cost_minor,planned_minutes)
  values(target,(p_data->>'cost_minor')::bigint,(p_data->>'planned_minutes')::integer)
  on conflict (product_id) do update set cost_minor=excluded.cost_minor,planned_minutes=excluded.planned_minutes;
  select count(*) into current_qty from public.product_units where product_id=target and status='available';
  if desired>current_qty then
    insert into public.product_units(product_id) select target from generate_series(1,desired-current_qty);
  elsif desired<current_qty then
    delete from public.product_units where id in (
      select u.id from public.product_units u where u.product_id=target and u.status='available'
      order by u.created_at desc,u.id limit (current_qty-desired)
    );
  end if;
  if p_data ? 'media' then
    if jsonb_typeof(p_data->'media') is distinct from 'array' then raise exception 'Invalid media list' using errcode='22023'; end if;
    if jsonb_array_length(p_data->'media')>12 or exists (
      select 1 from jsonb_array_elements(p_data->'media') img group by img->>'storage_path' having count(*)>1
    ) then raise exception 'Invalid photo count or duplicate path' using errcode='22023'; end if;
    delete from public.product_media m where m.product_id=target and not exists (
      select 1 from jsonb_array_elements(p_data->'media') img where img->>'storage_path'=m.storage_path
    );
    for item in select * from jsonb_to_recordset(p_data->'media') as x(storage_path text,sort_order int,alt_text text) loop
      if not exists(select 1 from storage.objects where bucket_id='product-media' and name=item.storage_path) then
        raise exception 'Upload the photo before saving' using errcode='22023';
      end if;
      insert into public.product_media(product_id,storage_path,sort_order,alt_text)
      values(target,item.storage_path,coalesce(item.sort_order,0),coalesce(item.alt_text,''))
      on conflict(storage_path) do update set sort_order=excluded.sort_order,alt_text=excluded.alt_text;
    end loop;
  end if;
  if status_value='published' then
    select exists(select 1 from public.product_media m where m.product_id=target) into has_media;
    if (p_data->>'price_minor')::bigint <=0 or (desired=0 and not (p_data->>'made_to_order')::boolean) or not has_media then
      raise exception 'Published product requires a photo, a positive price and an offer' using errcode='23514';
    end if;
  end if;
  return target;
end $$;
create function public.save_product(p_id uuid,p_data jsonb) returns uuid language sql security invoker set search_path=''
as $$select roomlet_private.save_product(p_id,p_data)$$;
create function roomlet_private.delete_product(p_id uuid,p_expected_updated_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
  perform roomlet_private.require_staff();
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  delete from public.products where id=p_id and updated_at=p_expected_updated_at;
  if not found then raise exception 'Product changed or already deleted' using errcode='40001'; end if;
end $$;
create function public.delete_product(p_id uuid,p_expected_updated_at timestamptz) returns void language sql security invoker set search_path=''
as $$select roomlet_private.delete_product(p_id,p_expected_updated_at)$$;

create function roomlet_private.save_workshop_settings(p_timezone text,p_currency text,p_buffer_minutes integer,p_hours jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare day_count integer;
begin
  perform roomlet_private.require_staff();
  if not exists(select 1 from pg_timezone_names where name=p_timezone) or jsonb_typeof(p_hours) is distinct from 'array' then
    raise exception 'Invalid timezone or working hours' using errcode='22023';
  end if;
  select count(distinct v.weekday) into day_count from jsonb_to_recordset(p_hours) as v(weekday int,minutes int);
  if day_count<>7 or jsonb_array_length(p_hours)<>7 then raise exception 'Supply seven distinct weekdays' using errcode='22023'; end if;
  update public.workshop_settings set timezone=p_timezone,currency=p_currency,buffer_minutes=p_buffer_minutes where id=1;
  insert into public.working_hours(weekday,minutes)
    select v.weekday,v.minutes from jsonb_to_recordset(p_hours) as v(weekday int,minutes int)
  on conflict(weekday) do update set minutes=excluded.minutes;
end $$;
create function public.save_workshop_settings(p_timezone text,p_currency text,p_buffer_minutes integer,p_hours jsonb) returns void
language sql security invoker set search_path='' as $$select roomlet_private.save_workshop_settings(p_timezone,p_currency,p_buffer_minutes,p_hours)$$;

create type public.roomlet_catalog_item as (
  id uuid, slug text, title text, description text, category_name text, dimensions text, materials text,
  price_minor bigint, currency text, ready_quantity integer, made_to_order boolean, requires_sketch boolean, media jsonb
);
create function roomlet_private.catalog() returns setof public.roomlet_catalog_item language sql stable security definer set search_path='' as $$
  select p.id,p.slug,p.title,p.description,c.name,p.dimensions,p.materials,o.price_minor,o.currency,
    (select count(*)::integer from public.product_units u where u.product_id=p.id and u.status='available'),
    o.made_to_order,o.requires_sketch,
    coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'storage_path',m.storage_path,'sort_order',m.sort_order,'alt_text',m.alt_text)
      order by m.sort_order,m.id) from public.product_media m where m.product_id=p.id),'[]'::jsonb)
  from public.products p join public.product_offers o on o.product_id=p.id join public.categories c on c.id=p.category_id
  where p.status='published' order by p.created_at desc,p.id
$$;
create function public.roomlet_catalog() returns setof public.roomlet_catalog_item language sql stable security invoker set search_path=''
as $$ select * from roomlet_private.catalog() $$;
create function roomlet_private.availability() returns table(day date,available_minutes integer) language sql stable security definer set search_path='' as $$
  with settings as (select (now() at time zone s.timezone)::date as today,s.buffer_minutes from public.workshop_settings s where s.id=1),
  dates as (select s.today+i as workday,s.buffer_minutes from settings s cross join generate_series(1,70) i)
  select d.workday,case when exists(select 1 from public.blocked_periods b where daterange(b.start_date,b.end_date,'[]') @> d.workday)
    then 0 else greatest(0,coalesce(h.minutes,0)-d.buffer_minutes) end
  from dates d left join public.working_hours h on h.weekday=extract(isodow from d.workday)::integer order by d.workday
$$;
create function public.roomlet_availability() returns table(day date,available_minutes integer) language sql stable security invoker set search_path=''
as $$select * from roomlet_private.availability()$$;

-- Supabase installations differ in default privileges; set every callable surface explicitly.
revoke all on function roomlet_private.save_product(uuid,jsonb),roomlet_private.delete_product(uuid,timestamptz),
  roomlet_private.save_workshop_settings(text,text,integer,jsonb),public.save_product(uuid,jsonb),
  public.delete_product(uuid,timestamptz),public.save_workshop_settings(text,text,integer,jsonb)
  from public,anon,authenticated;
grant execute on function roomlet_private.save_product(uuid,jsonb),roomlet_private.delete_product(uuid,timestamptz),
  roomlet_private.save_workshop_settings(text,text,integer,jsonb),public.save_product(uuid,jsonb),
  public.delete_product(uuid,timestamptz),public.save_workshop_settings(text,text,integer,jsonb) to authenticated;
revoke all on function roomlet_private.catalog(),public.roomlet_catalog(),roomlet_private.availability(),public.roomlet_availability() from public;
grant execute on function roomlet_private.catalog(),public.roomlet_catalog(),roomlet_private.availability(),public.roomlet_availability() to anon,authenticated;


-- Policies in Storage are shared by all buckets. Restrictive guards keep broad
-- policies left by other apps from widening Roomlet access. For other buckets
-- each guard is true and the project's existing policies continue to decide.
create policy roomlet_guard_anon_read on storage.objects as restrictive for select to anon
  using (bucket_id <> 'product-media' or roomlet_private.published_file(name));
create policy roomlet_guard_staff_read on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'product-media' or (select roomlet_private.is_staff()) or roomlet_private.published_file(name));
create policy roomlet_guard_anon_insert on storage.objects as restrictive for insert to anon
  with check (bucket_id <> 'product-media');
create policy roomlet_guard_staff_insert on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'product-media' or ((select roomlet_private.is_staff()) and
  name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'));
create policy roomlet_guard_immutable_photos on storage.objects as restrictive for update to anon,authenticated
  using (bucket_id <> 'product-media') with check (bucket_id <> 'product-media');
create policy roomlet_guard_anon_delete on storage.objects as restrictive for delete to anon
  using (bucket_id <> 'product-media');
create policy roomlet_guard_staff_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'product-media' or ((select roomlet_private.is_staff()) and not roomlet_private.file_attached(name)));
commit;
