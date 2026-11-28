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
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', banned_until timestamptz,
      encrypted_password text, recovery_token text, confirmation_token text, email_change text,
      email_change_token_current text, email_change_token_new text, email_change_confirm_status int,
      reauthentication_token text);
    create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users,
      provider text, provider_id text, identity_data jsonb default '{}', updated_at timestamptz default now(), unique(provider,provider_id));
    create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,created_at timestamptz default now());
    create table auth.refresh_tokens(id bigint generated always as identity,user_id varchar,revoked boolean default false,session_id uuid);
    create table auth.one_time_tokens(id uuid primary key default gen_random_uuid(),user_id uuid);
    create table auth.flow_state(id uuid primary key default gen_random_uuid(),user_id uuid);
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
  await t.test("Telegram launch is consumed once and only by the backend",async()=>{
    const key = "a".repeat(64);
    const consume = (seconds:number) => db.query<{used:boolean}>("select public.consume_telegram_launch($1,now()+$2*interval '1 second') as used",[key,seconds]);
    for (const account of [undefined,customer,maker]) {
      await asUser(account);
      await assert.rejects(consume(120),{code:"42501"});
    }
    await db.exec("reset role; set role service_role");
    assert.equal((await consume(-1)).rows[0].used,false);
    assert.equal((await consume(400)).rows[0].used,false);
    assert.equal((await consume(120)).rows[0].used,true);
    assert.equal((await consume(120)).rows[0].used,false);
  });
  await t.test("контактные данные сохраняются только у себя и не подтверждают почту",async()=>{
    await asUser(customer);
    await db.query("update profiles set contact_email='contact@example.test',contact_phone='+79991234567',display_name='Ирина' where id=$1",[customer]);
    assert.deepEqual((await db.query("select contact_email,contact_phone from profiles where id=$1",[customer])).rows,
      [{contact_email:'contact@example.test',contact_phone:'+79991234567'}]);
    assert.equal((await db.query("update profiles set contact_phone='+12025550123' where id=$1 returning id",[maker])).rows.length,0);
    await assert.rejects(db.query("update profiles set contact_phone='bad' where id=$1",[customer]),{code:'23514'});
    await assert.rejects(db.query("update profiles set contact_email='broken' where id=$1",[customer]),{code:'23514'});
    await db.exec('reset role');
    assert.equal((await db.query<{email_confirmed_at:null}>("select email_confirmed_at from auth.users where id=$1",[customer])).rows[0].email_confirmed_at,null);
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
    const settings = () => db.query<{timezone:string;configured:boolean}>("select timezone, (created_at <> updated_at or timezone <> 'UTC') as configured from workshop_settings");
    assert.deepEqual((await settings()).rows,[{timezone:"UTC",configured:false}]);
    await db.query("select save_workshop_settings($1,$2,$3,$4::jsonb)",["UTC","RUB",0,JSON.stringify(hours)]);
    assert.deepEqual((await settings()).rows,[{timezone:"UTC",configured:true}]);
    await db.query("select save_workshop_settings($1,$2,$3,$4::jsonb)",["Asia/Tokyo","JPY",45,JSON.stringify(hours)]);
    const days=(await db.query<{day:string;available_minutes:number}>("select day::text,available_minutes from roomlet_availability()")).rows;
    assert.equal(days.length,70);
    assert.ok(days.every(d=>d.available_minutes===255));
    await db.query("insert into blocked_periods(start_date,end_date,reason) values ($1,$1,'Личное время')",[days[0].day]);
    await asUser();
    assert.deepEqual((await db.query("select day::text,available_minutes from roomlet_availability() limit 1")).rows,[{day:days[0].day,available_minutes:0}]);
    const {schedule}=(await db.query<{schedule:{timezone:string;days:typeof days}}>("select roomlet_booking_calendar() as schedule")).rows[0];
    assert.deepEqual(schedule,{timezone:"Asia/Tokyo",days:[{day:days[0].day,available_minutes:0},...days.slice(1)]});
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
    await db.exec('reset role');
    const telegramUser=randomUUID();
    await db.query('insert into auth.users(id) values($1)',[telegramUser]);
    await db.query("insert into auth.identities(user_id,provider,provider_id,identity_data) values($1,'custom:roomlet-telegram','tg:123456789','{\"name\":\"Мастер без почты\",\"preferred_username\":\"maker_test\"}')",[telegramUser]);
    for(const actor of [undefined,customer,maker]) {
      await asUser(actor);
      await assert.rejects(db.query("select * from roomlet_find_team_account('123456789')"),{code:'42501'});
      await assert.rejects(db.query('select roomlet_grant_maker_by_id($1)',[telegramUser]),{code:'42501'});
    }
    await asUser(owner);
    assert.equal((await db.query<{user_id:string}>("select * from roomlet_find_team_account('123456789')")).rows[0].user_id,telegramUser);
    assert.equal((await db.query('select * from roomlet_find_team_account($1)',[telegramUser])).rows.length,1);
    assert.equal((await db.query("select * from roomlet_find_team_account('maker_test')")).rows.length,0);
    await db.query('select roomlet_grant_maker_by_id($1)',[telegramUser]);
    await asUser(telegramUser);
    assert.equal((await db.query('select * from workshop_settings')).rows.length,1);
    await asUser(owner);
    await db.query('select roomlet_revoke_maker($1)',[telegramUser]);
    await assert.rejects(db.query('select roomlet_grant_maker_by_id($1)',[owner]),{code:'42501'});
    await asUser(telegramUser);
    assert.equal((await db.query('select * from workshop_settings')).rows.length,0);
  });
  await t.test('согласие выключено в тестировании; опубликованные версии записываются атомарно с регистрацией',async()=>{
    await db.exec('reset role');
    const trial=randomUUID(), consented=randomUUID(), rejected=randomUUID();
    await db.query("insert into auth.users(id,email) values($1,'trial@example.test')",[trial]);
    assert.equal((await db.query('select * from roomlet_private.registration_consents')).rows.length,0);
    const documents={enabled:true,privacy:{url:'https://example.test/privacy',version:'p1'},consent:{url:'https://example.test/consent',version:'c1'}};
    await db.query('update workshop_settings set registration_documents=$1',[JSON.stringify(documents)]);
    await assert.rejects(db.query("insert into auth.users(id,email) values($1,'rejected@example.test')",[rejected]),{code:'23514'});
    assert.equal((await db.query('select id from auth.users where id=$1',[rejected])).rows.length,0);
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'consented@example.test',$2)",[consented,JSON.stringify({registration_consent:{accepted:true,privacy_version:'p1',consent_version:'c1'}})]);
    const receipt=(await db.query<{documents:typeof documents;dated:boolean}>('select documents,accepted_at<=now()+interval \'1 second\' as dated from roomlet_private.registration_consents where user_id=$1',[consented])).rows[0];
    assert.deepEqual(receipt.documents,documents); assert.equal(receipt.dated,true);
    await asUser(consented);
    await assert.rejects(db.query('select * from roomlet_private.registration_consents'),{code:'42501'});
    assert.deepEqual((await db.query('select roomlet_registration_documents() as documents')).rows[0],{documents});
    await db.exec('reset role');
    await db.query('update workshop_settings set registration_documents=null');
  });
  await t.test('перенос Telegram сохраняет owner, заказы и исходную запись; доступен только серверу',async()=>{
    await db.exec('reset role');
    const target=randomUUID(),source=randomUUID(),other=randomUUID();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'link@example.test',now()),($2,null,null),($3,null,null)",[target,source,other]);
    await db.query("update profiles set role='owner' where id=$1",[target]);
    await db.query("update profiles set contact_phone='+12025550123' where id=$1",[source]);
    await db.query("insert into auth.identities(user_id,provider,provider_id) values($1,'email','owner-link'),($2,'custom:roomlet-telegram','tg:987654321')",[target,source]);
    await db.query("insert into orders(customer_id,currency,total_minor) values($1,'RUB',100)",[source]);
    await db.query("insert into auth.sessions(user_id) values($1)",[source]);
    await db.query("insert into auth.refresh_tokens(user_id) values($1)",[source]);
    const proof='d'.repeat(64);
    const transfer=()=>db.query<{roomlet_transfer_telegram:boolean}>('select roomlet_transfer_telegram($1,$2,$3)',[target,'987654321',proof]);
    for(const actor of [undefined,source,target]) { await asUser(actor); await assert.rejects(transfer(),{code:'42501'}); }
    await db.exec('reset role; set role service_role');
    await assert.rejects(transfer(),{code:'42501'});
    await db.query("select consume_telegram_launch($1,now()+interval '1 minute')",[proof]);
    await db.exec('reset role');
    const snapshot=async()=> (await db.query(`select jsonb_build_object(
      'identity',(select user_id from auth.identities where provider_id='tg:987654321'),
      'order_owner',(select customer_id from orders where customer_id in ($1,$2) limit 1),
      'target_phone',(select contact_phone from profiles where id=$1),
      'target_role',(select role from profiles where id=$1),
      'source_banned',(select banned_until from auth.users where id=$2),
      'sessions',(select count(*) from auth.sessions where user_id=$2),
      'revoked',(select revoked from auth.refresh_tokens where user_id=$2::text),
      'transfers',(select count(*) from roomlet_private.telegram_account_transfers where source_id=$2)) as value`,[target,source])).rows[0];
    const before=await snapshot();
    // Reproduce the production dependency omission without deleting any rows.
    await db.exec('alter table public.notification_preferences rename to preferences_dependency_fixture; set role service_role');
    await assert.rejects(transfer(),{code:'42P01'});
    await db.exec('reset role');
    assert.deepEqual(await snapshot(),before,'A missing dependency must roll back earlier writes');
    await db.exec('alter table public.preferences_dependency_fixture rename to notification_preferences');
    // Fail later at the identity update, after orders and contacts were moved.
    await db.exec('create unique index transfer_failure_fixture on auth.identities(user_id); set role service_role');
    await assert.rejects(transfer(),{code:'23505'});
    await db.exec('reset role');
    assert.deepEqual(await snapshot(),before,'An identity constraint must roll back all related data');
    await db.exec('drop index auth.transfer_failure_fixture; set role service_role');
    assert.equal((await transfer()).rows[0].roomlet_transfer_telegram,true);
    assert.equal((await db.query<{merged:boolean}>('select roomlet_telegram_account_merged($1) as merged',[source])).rows[0].merged,true);
    assert.equal((await transfer()).rows[0].roomlet_transfer_telegram,true);
    await assert.rejects(db.query('select roomlet_transfer_telegram($1,$2,$3)',[other,'987654321',proof]),{code:'42501'});
    await db.exec('reset role');
    assert.equal((await db.query<{user_id:string}>("select user_id from auth.identities where provider_id='tg:987654321'")).rows[0].user_id,target);
    assert.equal((await db.query<{role:string}>('select role from profiles where id=$1',[target])).rows[0].role,'owner');
    assert.equal((await db.query<{role:string}>('select role from profiles where id=$1',[source])).rows[0].role,'customer');
    assert.equal((await db.query<{n:number}>('select count(*)::int n from orders where customer_id=$1',[target])).rows[0].n,1);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from auth.sessions where user_id=$1',[source])).rows[0].n,0);
    assert.equal((await db.query<{revoked:boolean}>('select revoked from auth.refresh_tokens where user_id=$1',[source])).rows[0].revoked,true);
    assert.equal((await db.query<{contact_phone:string}>('select contact_phone from profiles where id=$1',[target])).rows[0].contact_phone,'+12025550123');
    await asUser(source);
    await assert.rejects(db.query('select * from roomlet_private.telegram_account_transfers'),{code:'42501'});
    assert.equal((await db.query('select * from workshop_settings')).rows.length,0);
  });
  await t.test('отключение требует оставшегося способа и отзывает старые сеансы без потери профиля',async()=>{
    await db.exec('reset role');
    const user=randomUUID(),emailId=randomUUID(),tgId=randomUUID(),fresh=randomUUID(),old=randomUUID();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values ($1,'unlink@example.test',now())",[user]);
    await db.query("update profiles set role='owner',contact_phone='+12025550123' where id=$1",[user]);
    await db.query("insert into auth.identities(id,user_id,provider,provider_id) values ($1,$3,'email',$3::uuid::text),($2,$3,'custom:roomlet-telegram','tg:555666777')",[emailId,tgId,user]);
    await db.query('insert into auth.sessions(id,user_id) values ($1,$3),($2,$3)',[fresh,old,user]);
    await db.query('insert into auth.refresh_tokens(user_id,session_id) values ($1,$2),($1,$3)',[user,fresh,old]);
    // A direct Supabase unlink must not bypass fresh proof, even with two identities.
    await assert.rejects(db.query('delete from auth.identities where id=$1',[tgId]),{code:'42501'});
    const prepare=(remove:string,retain:string)=>db.query('select public.roomlet_prepare_disconnect($1,$2,$3,$4)',[user,remove,retain,fresh]);
    for(const account of [undefined,user]) {await asUser(account);await assert.rejects(prepare(tgId,emailId),{code:'42501'});}
    await db.exec('reset role; set role service_role');
    // Verified email alone is not a usable password login.
    await assert.rejects(prepare(tgId,emailId),{code:'42501'});
    await db.exec('reset role');
    await db.query("update auth.users set encrypted_password='test-password-hash' where id=$1",[user]);
    await db.exec('set role service_role');await prepare(tgId,emailId);
    await db.exec('reset role');
    await db.query('delete from auth.identities where id=$1',[tgId]);
    assert.deepEqual((await db.query('select id,role,contact_phone from profiles where id=$1',[user])).rows,[{id:user,role:'owner',contact_phone:'+12025550123'}]);
    assert.deepEqual((await db.query('select id from auth.sessions where user_id=$1',[user])).rows,[]);
    assert.equal((await db.query<{revoked:boolean}>('select revoked from auth.refresh_tokens where session_id=$1',[old])).rows[0].revoked,true);
    await asUser(user);
    assert.deepEqual((await db.query('select id from profiles where id=$1',[user])).rows,[]);
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({session_id:fresh})]);
    assert.equal((await db.query('select id from profiles where id=$1',[user])).rows.length,0);
    // Signing in again via the surviving method restores access to this UUID.
    await db.exec('reset role');
    await db.query('insert into auth.sessions(id,user_id) values ($1,$2)',[fresh,user]);
    await asUser(user);
    assert.equal((await db.query('select id from profiles where id=$1',[user])).rows.length,1);
    await db.exec('reset role; set role service_role');
    await assert.rejects(prepare(emailId,tgId),{code:'42501'});
    assert.equal((await db.query<{detached:boolean}>("select public.roomlet_telegram_detached('555666777') as detached")).rows[0].detached,true);
    await db.exec('reset role');
    const duplicate=randomUUID();
    await assert.rejects(db.transaction(async tx=>{
      await tx.query('insert into auth.users(id) values ($1)',[duplicate]);
      await tx.query("insert into auth.identities(user_id,provider,provider_id) values ($1,'custom:roomlet-telegram','tg:555666777')",[duplicate]);
    }),{code:'42501'});
    assert.equal((await db.query('select id from profiles where id=$1',[duplicate])).rows.length,0);
    // Reconnecting creates an identity on the SAME UUID, never a new user.
    await db.exec('reset role');
    const reconnected=randomUUID();
    await db.query("insert into auth.identities(id,user_id,provider,provider_id) values ($1,$2,'custom:roomlet-telegram','tg:555666777')",[reconnected,user]);
    await db.exec('set role service_role');
    assert.equal((await db.query<{detached:boolean}>("select public.roomlet_telegram_detached('555666777') as detached")).rows[0].detached,false);
    await assert.rejects(prepare(emailId,reconnected),{code:'42501'});
    const proof='d'.repeat(64);
    await db.query("select consume_telegram_launch($1,now()+interval '2 minutes')",[proof]);
    await db.query('select public.roomlet_prepare_disconnect($1,$2,$3,$4,$5)',[user,emailId,reconnected,fresh,proof]);
    await db.exec('reset role');
    await db.query("update auth.users set recovery_token='old-code',email_change='pending@example.test' where id=$1",[user]);
    await db.query('insert into auth.one_time_tokens(user_id) values ($1)',[user]);
    await db.query('delete from auth.identities where id=$1',[emailId]);
    const auth=(await db.query<{email:string|null;encrypted_password:string;recovery_token:string;email_change:string}>('select email,encrypted_password,recovery_token,email_change from auth.users where id=$1',[user])).rows[0];
    assert.ok(!auth.email);assert.ok(!auth.encrypted_password);assert.ok(!auth.recovery_token);assert.ok(!auth.email_change);
    assert.equal((await db.query('select id from auth.one_time_tokens where user_id=$1',[user])).rows.length,0);
    await assert.rejects(db.query('delete from auth.identities where id=$1',[reconnected]),{code:'42501'});
    await db.query("insert into auth.identities(user_id,provider,provider_id) values ($1,'email',$1::uuid::text)",[user]);
    await db.query("update auth.users set email='unlink@example.test',email_confirmed_at=now(),encrypted_password='new-test-hash' where id=$1",[user]);
    assert.equal((await db.query('select id from auth.users where id=$1',[user])).rows.length,1);
    assert.equal((await db.query<{role:string}>('select role from profiles where id=$1',[user])).rows[0].role,'owner');
  });
});
