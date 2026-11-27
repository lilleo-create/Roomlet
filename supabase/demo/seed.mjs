import { readFile } from "node:fs/promises";
import { samples } from "./products.mjs";

const bucket = "product-media";
async function ensurePhoto(storage, sample, detail = false) {
  const filename = sample.key + (detail ? "-detail.webp" : ".webp");
  const path = detail ? sample.detailPath : sample.photoPath;
  const bytes = await readFile(new URL("../../assets/demo/catalog/" + filename, import.meta.url));
  const { data: current, error: readError } = await storage.from(bucket).list(sample.id, { search: path.split("/")[1] });
  if (readError) throw readError;
  if (current.some(entry => entry.name === path || entry.name === path.split("/")[1])) return;
  const { error } = await storage.from(bucket).upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (error) throw error;
}

async function addDetail(tx, sample) {
  await tx.query(`insert into public.product_media(product_id,storage_path,alt_text,sort_order)
    values($1,$2,$3,(select least(1000,coalesce(max(sort_order),-1)+1) from public.product_media where product_id=$1))
    on conflict(storage_path) do nothing`,[sample.id,sample.detailPath,sample.detailAlt]);
  await tx.query("insert into roomlet_private.demo_seed_state(name) values($1) on conflict do nothing",["detail:"+sample.key]);
}

// Only called on the embedded PostgreSQL instance created by runtime.mjs.
// Fixed IDs plus the per-row marker prevent adopting or deleting unrelated objects.
export async function seedDemo(db, storage) {
  await flushCleanup(db, storage);
  for (const sample of samples) {
    const existing = (await db.query("select is_demo from public.products where id=$1", [sample.id])).rows[0];
    if (existing && !existing.is_demo) throw new Error("ID belongs to a non-demo product: " + sample.id);
    const completed = (await db.query("select 1 from roomlet_private.demo_seed_state where name=$1", [sample.key])).rows.length;
    if (existing && completed) {
      const marked = (await db.query("select 1 from roomlet_private.demo_seed_state where name=$1", ["detail:"+sample.key])).rows.length;
      if (!marked) {
        // Upgrade the first preview once. Preserve edits and never re-add a manually removed photo.
        const count = (await db.query("select count(*)::int as n from public.product_media where product_id=$1", [sample.id])).rows[0].n;
        if (count < 12) {
          await ensurePhoto(storage,sample,true);
          await db.transaction(async tx => {
            const owned = (await tx.query("select is_demo from public.products where id=$1 for update",[sample.id])).rows[0];
            if (!owned?.is_demo) throw new Error("Demo ownership changed");
            await addDetail(tx,sample);
            await tx.query("update public.products set status=status where id=$1", [sample.id]);
          });
        }
      }
      continue;
    }
    await db.transaction(async (tx) => {
      const categorySlug = "roomlet-demo-" + sample.key;
      const categoryMarker = "category:" + sample.key;
      const category = (await tx.query("select slug from public.categories where id=$1",[sample.categoryId])).rows[0];
      if (category) {
        const owned = (await tx.query("select 1 from roomlet_private.demo_seed_state where name=$1",[categoryMarker])).rows.length;
        if (!owned || category.slug !== categorySlug) throw new Error("Category ID collision");
      } else {
        await tx.query("insert into public.categories(id,slug,name) values($1,$2,$3)", [sample.categoryId,categorySlug,sample.category]);
        await tx.query("insert into roomlet_private.demo_seed_state(name) values($1) on conflict do nothing",[categoryMarker]);
      }
      await tx.query(`insert into public.products(id,slug,title,description,category_id,dimensions,materials,status,is_demo,catalog_stage)
        values($1,$2,$3,$4,$5,$6,$7,'draft',true,$8) on conflict(id) do nothing`,
      [sample.id,sample.key,sample.title,sample.description,sample.categoryId,sample.dimensions,sample.materials,sample.stage]);
    });
    await ensurePhoto(storage, sample);
    await ensurePhoto(storage, sample, true);
    await db.transaction(async (tx) => {
      const row = (await tx.query("select is_demo from public.products where id=$1 for update",[sample.id])).rows[0];
      if (!row?.is_demo) throw new Error("Demo ownership changed");
      await tx.query(`insert into public.product_offers(product_id,price_minor,currency,made_to_order,requires_sketch)
        values($1,$2,'RUB',$3,$4) on conflict(product_id) do nothing`,[sample.id,sample.price,sample.made,sample.sketch]);
      await tx.query("insert into public.product_costs(product_id,cost_minor,planned_minutes) values($1,$2,$3) on conflict(product_id) do nothing",
        [sample.id,sample.cost,sample.minutes]);
      if (sample.stock || sample.stage === "sold") {
        await tx.query("insert into public.product_units(id,product_id,status) values($1,$2,$3) on conflict(id) do nothing",
          [sample.id.replace("bee1","bee4"),sample.id,sample.stock ? "available" : "sold"]);
      }
      await tx.query("insert into public.product_media(product_id,storage_path,alt_text) values($1,$2,$3) on conflict(storage_path) do nothing",
        [sample.id,sample.photoPath,sample.alt]);
      await addDetail(tx,sample);
      await tx.query("update public.products set status='published' where id=$1 and is_demo", [sample.id]);
      await tx.query("insert into roomlet_private.demo_seed_state(name) values($1) on conflict do nothing",[sample.key]);
    });
  }
  await db.query("insert into roomlet_private.demo_seed_state(name) values('initialized') on conflict do nothing");
}

async function flushCleanup(db, storage) {
  const rows = (await db.query("select path from roomlet_private.demo_cleanup_media")).rows;
  for (const {path} of rows) {
    const { error } = await storage.from(bucket).remove([path]);
    if (error) throw error;
    await db.query("delete from roomlet_private.demo_cleanup_media where path=$1", [path]);
  }
}

export async function cleanDemo(db, storage) {
  await db.transaction(async (tx) => {
    for (const sample of samples) {
      const item = (await tx.query("select is_demo from public.products where id=$1 for update",[sample.id])).rows[0];
      if (item && !item.is_demo) throw new Error("Refusing to change a non-demo product");
      const registered = (await tx.query("select 1 from roomlet_private.demo_seed_state where name=$1", [sample.key])).rows.length;
      if (item || registered) {
        // Also recover uploaded bytes from a previous interrupted save/delete of this sample.
        // Only its reserved UUID namespace in the isolated preview bucket is eligible.
        await tx.query(`insert into roomlet_private.demo_cleanup_media(path) select name from storage.objects
          where bucket_id='product-media' and split_part(name,'/',1)=$1 on conflict do nothing`,[sample.id]);
        if (item) await tx.query("delete from public.products where id=$1 and is_demo", [sample.id]);
      }
      const marker = "category:" + sample.key;
      await tx.query(`delete from public.categories where id=$1 and slug=$2
        and exists(select 1 from roomlet_private.demo_seed_state where name=$3)
        and not exists(select 1 from public.products where category_id=$1)`,[sample.categoryId,"roomlet-demo-"+sample.key,marker]);
      await tx.query(`delete from roomlet_private.demo_seed_state where name=$1
        and not exists(select 1 from public.categories where id=$2)`,[marker,sample.categoryId]);
      await tx.query("delete from roomlet_private.demo_seed_state where name in ($1,$2)",[sample.key,"detail:"+sample.key]);
    }
    await tx.query("insert into roomlet_private.demo_seed_state(name) values('initialized') on conflict do nothing");
  });
  await flushCleanup(db, storage);
}
