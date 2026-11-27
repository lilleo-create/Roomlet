import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { migratePreview } from "../supabase/demo/migrate.mjs";
import { seedDemo, cleanDemo } from "../supabase/demo/seed.mjs";
import { provisionPreviewAccounts } from "../supabase/demo/accounts.mjs";
import { samples } from "../supabase/demo/products.mjs";

test("Повторный seed сохраняет правки мастера, очистка затрагивает только демоколлекцию", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text unique);
  `);
  await migratePreview(db);
  await migratePreview(db);
  const storage = {from(bucket) {
    assert.equal(bucket,"product-media");
    return {
      async list(prefix) {
        return {data:(await db.query("select name from storage.objects where name like $1",[prefix+"/%"])).rows};
      },
      async upload(name,bytes) {
        assert.equal(bytes.toString("ascii",8,12),"WEBP");
        await db.query("insert into storage.objects(bucket_id,name) values($1,$2)",[bucket,name]);
        return {error:null};
      },
      async remove(paths) {
        for (const path of paths) await db.query("delete from storage.objects where bucket_id=$1 and name=$2",[bucket,path]);
        return {error:null};
      },
    };
  }};
  const catalog = async ()=>(await db.query("select * from public.roomlet_catalog() order by id")).rows;
  await seedDemo(db,storage);
  const rows=await catalog();
  assert.deepEqual(rows.map(r=>[r.title,Number(r.price_minor),r.ready_quantity,r.made_to_order,r.catalog_stage,r.is_demo,r.media.length]), [
    ["Ночная библиотека",650000,1,false,"active",true,2],
    ["Токийское кафе",590000,0,true,"active",true,2],
    ["Оранжерея",790000,0,false,"upcoming",true,2],
    ["Ателье художника",850000,0,false,"sold",true,2],
  ]);
  // Simulate the preview originally seeded with one picture. Its first upgrade
  // adds a detail once, while later manual removals are preserved.
  const library=samples[0];
  await db.query("delete from public.product_media where storage_path=$1", [library.detailPath]);
  await db.query("delete from roomlet_private.demo_seed_state where name=$1", ["detail:"+library.key]);
  await seedDemo(db,storage);
  assert.equal((await catalog())[0].media.length, 2);
  await db.query("delete from public.product_media where storage_path=$1", [library.detailPath]);
  await seedDemo(db,storage);
  assert.equal((await catalog())[0].media.length, 1);
  const maker="10000000-0000-4000-a000-000000000001";
  await db.query("insert into auth.users values($1)",[maker]);
  await db.query("update public.profiles set role='maker' where id=$1",[maker]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[maker]);
  const upcoming=samples[2];
  const version=(await db.query("select updated_at::text from public.products where id=$1",[upcoming.id])).rows[0].updated_at;
  const fields={title:"Свежие посадки",slug:upcoming.key,status:"published",catalog_stage:"upcoming",
    category_id:upcoming.categoryId,ready_quantity:0,price_minor:795000,cost_minor:320000,
    currency:"RUB",made_to_order:false,requires_sketch:false,planned_minutes:900,expected_updated_at:version};
  await db.query("select public.save_product($1,$2::jsonb)",[upcoming.id,JSON.stringify(fields)]);
  await seedDemo(db,storage);
  assert.equal((await catalog())[2].title,"Свежие посадки");
  await db.query("insert into public.products(slug,title,category_id) values('independent','Личная работа',$1)",[upcoming.categoryId]);
  await cleanDemo(db,storage);
  await cleanDemo(db,storage);
  assert.deepEqual(await catalog(),[]);
  assert.deepEqual((await db.query("select slug from public.products")).rows,[{slug:"independent"}]);
  assert.deepEqual((await db.query("select id from public.categories")).rows,[{id:upcoming.categoryId}]);
  assert.deepEqual((await db.query("select name from storage.objects")).rows,[]);
  await seedDemo(db,storage);
  assert.equal((await catalog()).length,4);

  await t.test("Демоаккаунты сохраняют отозванную роль и выбранное имя при перезапуске", async () => {
    const accounts = ["owner", "maker", "customer"].map(role => ({
      role, email: role + "@roomlet.local", password: "local-test",
    }));
    const auth = {
      async createUser({ email }) {
        const user = (await db.query(
          "insert into auth.users values(gen_random_uuid(), $1, now()) returning id", [email],
        )).rows[0];
        return { data: { user }, error: null };
      },
    };
    const profiles = async () => (await db.query(`
      select role, display_name from public.profiles join auth.users using (id)
      where email like '%@roomlet.local' order by email
    `)).rows;
    await provisionPreviewAccounts(db, auth, accounts, auth);
    assert.deepEqual(await profiles(), [
      { role: "customer", display_name: "Покупатель Roomlet" },
      { role: "maker", display_name: "Мастер Roomlet" },
      { role: "owner", display_name: "Владелец Roomlet" },
    ]);
    await db.query("update public.profiles set role='customer', display_name='Имя мастера' where id=(select id from auth.users where email=$1)", [accounts[1].email]);
    await provisionPreviewAccounts(db, auth, accounts, auth);
    assert.deepEqual((await profiles())[1], { role: "customer", display_name: "Имя мастера" });
  });
});
