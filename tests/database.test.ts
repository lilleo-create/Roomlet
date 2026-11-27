import assert from "node:assert/strict";
import test from "node:test";
import {readFile, readdir} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";

// PostgreSQL runs the migration as written. Minimal stand-ins supply only the
// Auth identity and Storage metadata that Supabase normally provisions.
test("Phase 02 · PostgreSQL, RLS и Storage", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create policy existing_read on storage.objects for select to anon, authenticated using (true);
    grant usage on schema auth,storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
  `);
  for (const file of (await readdir("supabase/migrations")).filter(name => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  }
  const maker=randomUUID(), customer=randomUUID(), id=randomUUID(), photo=id+"/"+randomUUID()+".webp";
  await db.query("insert into auth.users(id) values ($1),($2)",[maker,customer]);
  await db.query("update public.profiles set role='maker' where id=$1",[maker]);
  await db.query("insert into public.orders(currency,total_minor) values ('RUB',12500)");
  const category=(await db.query<{id:string}>("insert into public.categories(name,slug) values ('Тест','test') returning id")).rows[0].id;
  async function asUser(user?:string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||""]);
    await db.exec(user?"set role authenticated":"set role anon");
  }
  const card={slug:"test",title:"Столик",category_id:category,price_minor:12003,currency:"RUB",made_to_order:true,requires_sketch:false,ready_quantity:2,cost_minor:4200,planned_minutes:60,status:"draft"};
  const save=(changes:Record<string,unknown>={})=>db.query("select public.save_product($1,$2::jsonb)",[id,JSON.stringify({...card,...changes})]);
  const version=async()=> (await db.query<{stamp:string}>("select updated_at::text stamp from public.products where id=$1",[id])).rows[0].stamp;
  await t.test("на всех прикладных таблицах включена RLS, регистрация создаёт клиента",async()=>{
    assert.equal((await db.query<{n:number}>("select count(*)::int n from pg_tables where schemaname='public' and rowsecurity")).rows[0].n,18);
    await asUser(customer);
    assert.deepEqual((await db.query("select role from profiles")).rows,[{role:"customer"}]);
    assert.deepEqual((await db.query("select id from orders")).rows,[]);
    assert.deepEqual((await db.query("select * from workshop_settings")).rows,[]);
    await assert.rejects(db.query("update profiles set role='maker' where id=$1",[customer]),{code:"42501"});
    await assert.rejects(save(),{code:"42501"});
  });
  await t.test("черновик, его цена закупки и фотография закрыты от посетителя",async()=>{
    await asUser(maker);
    await db.query("insert into storage.objects(bucket_id,name) values ('product-media',$1)",[photo]);
    await save({media:[{storage_path:photo,sort_order:0,alt_text:"Столик"}]});
    await asUser();
    assert.deepEqual((await db.query("select * from public.roomlet_catalog()")).rows,[]);
    assert.deepEqual((await db.query("select * from storage.objects")).rows,[]);
    await asUser(customer);
    assert.deepEqual((await db.query("select * from product_costs")).rows,[]);
  });
  await t.test("публикация и архив меняют публичную доступность модели и снимка",async()=>{
    await asUser(maker);
    const draftVersion=await version();
    await save({status:"published",expected_updated_at:draftVersion});
    await assert.rejects(save({expected_updated_at:draftVersion}),{code:"40001"});
    await asUser();
    const row=(await db.query<{ready_quantity:number;made_to_order:boolean;price_minor:number}>("select * from roomlet_catalog()")).rows[0];
    assert.equal(row.ready_quantity,2);
    assert.equal(row.made_to_order,true);
    assert.equal(row.price_minor,12003);
    assert.ok(!Object.hasOwn(row,"cost_minor"));
    assert.equal((await db.query<{name:string}>("select name from storage.objects")).rows[0].name,photo);
    await asUser(maker);
    await save({status:"archived",expected_updated_at:await version()});
    await asUser();
    assert.deepEqual((await db.query("select * from storage.objects")).rows,[]);
    assert.deepEqual((await db.query("select * from roomlet_catalog()")).rows,[]);
    await asUser(maker);
    await db.query("select public.delete_product($1,$2)",[id,await version()]);
    assert.deepEqual((await db.query("select id from product_units where product_id=$1",[id])).rows,[]);
  });
  await t.test("часовой пояс, резерв и блокировка определяют публичное расписание",async()=>{
    await asUser(maker);
    const hours=Array.from({length:7},(_,i)=>({weekday:i+1,minutes:300}));
    await db.query("select save_workshop_settings($1,$2,$3,$4::jsonb)",["Asia/Tokyo","JPY",45,JSON.stringify(hours)]);
    const days=(await db.query<{day:string;available_minutes:number}>("select day::text,available_minutes from roomlet_availability()")).rows;
    assert.equal(days.length,70);
    assert.ok(days.every(d=>d.available_minutes===255));
    await db.query("insert into blocked_periods(start_date,end_date,reason) values ($1,$1,'Личное время')",[days[0].day]);
    await asUser();
    assert.deepEqual((await db.query("select day::text,available_minutes from roomlet_availability() limit 1")).rows,[{day:days[0].day,available_minutes:0}]);
    await assert.rejects(db.query("select * from blocked_periods"),{code:"42501"});
  });

  await t.test("предпочтения и отдельное согласие принадлежат пользователю", async () => {
    await asUser();
    await assert.rejects(db.query("select save_notification_preferences(true,true)"), {code:"42501"});
    await asUser(customer);
    for (const [orders, marketing] of [[true,false],[true,true],[false,true],[false,false]]) {
      await db.query("select save_notification_preferences($1,$2)", [orders,marketing]);
    }
    assert.equal((await db.query<{ order_updates: boolean }>("select order_updates from notification_preferences")).rows[0].order_updates,false);
    await asUser(maker);
    assert.equal((await db.query("select * from notification_preferences")).rows.length,0);
    await assert.rejects(db.query("insert into notification_preferences(profile_id,marketing_opt_in) values ($1,true)", [customer]),{code:"42501"});
    await assert.rejects(db.query("select * from roomlet_private.marketing_consent_events"),{code:"42501"});
    await db.exec("reset role");
    const events = await db.query<{ opted_in: boolean }>("select opted_in from roomlet_private.marketing_consent_events where profile_id=$1 order by id",[customer]);
    assert.deepEqual(events.rows.map(row => row.opted_in), [true,false]);
  });
  await t.test("владелец управляет мастерами, роли проверяются заново для того же пользователя", async () => {
    await db.exec("reset role");
    const owner = randomUUID();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.test',now())", [owner]);
    await db.query("update profiles set role='owner' where id=$1", [owner]);
    await db.query("update auth.users set email='customer@example.test' where id=$1", [customer]);
    await db.query("update auth.users set email='maker@example.test',email_confirmed_at=now() where id=$1", [maker]);
    for (const actor of [undefined, customer, maker]) {
      await asUser(actor);
      await assert.rejects(db.query("select * from roomlet_team_members()"), { code: "42501" });
      await assert.rejects(db.query("select roomlet_grant_maker('customer@example.test')"), { code: "42501" });
      await assert.rejects(db.query("select roomlet_revoke_maker($1)", [maker]), { code: "42501" });
    }
    await asUser(customer);
    await db.query("update profiles set display_name='Анна' where id=$1", [customer]);
    assert.equal((await db.query("update profiles set display_name='Другой' where id=$1 returning id", [owner])).rows.length, 0);
    await assert.rejects(db.query("update profiles set role='owner' where id=$1", [customer]), { code: "42501" });

    await asUser(owner);
    assert.equal((await db.query("select * from roomlet_team_members()")).rows.length, 2);
    await assert.rejects(db.query("select roomlet_grant_maker('customer@example.test')"), { code: "P0002" });
    await assert.rejects(db.query("select roomlet_revoke_maker($1)", [owner]), { code: "42501" });
    await assert.rejects(db.query("select roomlet_grant_maker('owner@example.test')"), { code: "42501" });
    await db.exec("reset role");
    await assert.rejects(db.query("update profiles set role='maker' where id=$1", [owner]), { code: "23514" });
    await assert.rejects(db.query("delete from auth.users where id=$1", [owner]), { code: "23514" });
    await db.query("update auth.users set email_confirmed_at=now() where id=$1", [customer]);
    await asUser(owner);
    await db.query("select roomlet_grant_maker(' CUSTOMER@example.test ')");
    assert.equal((await db.query("select * from roomlet_team_members()")).rows.length, 3);
    await asUser(customer);
    assert.equal((await db.query("select * from workshop_settings")).rows.length, 1);
    await asUser(owner);
    await db.query("select roomlet_revoke_maker($1)", [customer]);
    await asUser(customer);
    assert.equal((await db.query("select * from workshop_settings")).rows.length, 0);
    await assert.rejects(save(), { code: "42501" });
  });
});
