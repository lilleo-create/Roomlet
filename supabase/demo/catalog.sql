-- Local preview extension. The demo launcher applies this only to its own embedded database.
begin;
alter table public.products add column is_demo boolean not null default false;
alter table public.products add column catalog_stage text not null default 'active'
  check (catalog_stage in ('active','upcoming','sold') and (is_demo or catalog_stage='active'));
create table roomlet_private.demo_seed_state (name text primary key);
create table roomlet_private.demo_cleanup_media (path text primary key);
revoke all on roomlet_private.demo_cleanup_media, roomlet_private.demo_seed_state from public, anon, authenticated;

alter type public.roomlet_catalog_item add attribute catalog_stage text;
alter type public.roomlet_catalog_item add attribute is_demo boolean;
create or replace function roomlet_private.catalog() returns setof public.roomlet_catalog_item
language sql stable security definer set search_path='' as $$
  select p.id,p.slug,p.title,p.description,c.name,p.dimensions,p.materials,o.price_minor,o.currency,
    (select count(*)::integer from public.product_units u where u.product_id=p.id and u.status='available'),
    o.made_to_order,o.requires_sketch,
    coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'storage_path',m.storage_path,'sort_order',m.sort_order,'alt_text',m.alt_text)
      order by m.sort_order,m.id) from public.product_media m where m.product_id=p.id),'[]'::jsonb),
    p.catalog_stage,p.is_demo
  from public.products p join public.product_offers o on o.product_id=p.id join public.categories c on c.id=p.category_id
  where p.status='published' order by p.created_at desc,p.id
$$;

create function roomlet_private.save_preview_product(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  is_sample boolean;
  target uuid;
  stage text;
  fields jsonb := p_data;
begin
  perform roomlet_private.require_staff();
  if p_id is not null then perform pg_advisory_xact_lock(hashtextextended(p_id::text,0)); end if;
  select is_demo,catalog_stage into is_sample,stage from public.products where id=p_id;
  stage := coalesce(p_data->>'catalog_stage',stage,'active');
  if stage not in ('active','upcoming','sold') or (stage <> 'active' and not coalesce(is_sample,false)) then
    raise exception 'Invalid preview stage' using errcode='22023';
  end if;
  if stage <> 'active' and ((p_data->>'ready_quantity')::int <> 0 or (p_data->>'made_to_order')::boolean) then
    raise exception 'Display-only product cannot have available offers' using errcode='23514';
  end if;
  -- Normal edits retain Phase 02 validation. A display-only demo validates its photograph and
  -- price here, then promotes the draft in this same transaction without creating a sellable offer.
  if stage <> 'active' and fields->>'status'='published' then
    fields := jsonb_set(fields,'{status}','"draft"');
  end if;
  target := roomlet_private.save_product(p_id,fields);
  if stage <> 'active' and p_data->>'status'='published' then
    if (p_data->>'price_minor')::bigint<=0 or not exists(select 1 from public.product_media where product_id=target) then
      raise exception 'Published preview requires a photo and a price' using errcode='23514';
    end if;
  end if;
  update public.products set status=p_data->>'status',catalog_stage=stage where id=target and
    (status is distinct from (p_data->>'status') or catalog_stage is distinct from stage);
  return target;
end $$;
revoke all on function roomlet_private.save_preview_product(uuid,jsonb) from public, anon, authenticated;
grant execute on function roomlet_private.save_preview_product(uuid,jsonb) to authenticated;
create or replace function public.save_product(p_id uuid,p_data jsonb) returns uuid language sql security invoker set search_path=''
as $$ select roomlet_private.save_preview_product(p_id,p_data) $$;
commit;
