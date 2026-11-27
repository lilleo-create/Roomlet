/**
 * Run against a fresh production build: node tests/integration/store-http.mjs
 * Exercises Next routes and the real Supabase client. The backend is a local
 * fixture at the HTTP boundary. Database privileges are checked by the SQL suite.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";

const id = "de2b2afc-6649-400d-8631-0e63b0221961";
const cover = "4cdf1d19-dea7-4771-81aa-5360db614092.webp";
const newCover = "e9cbe338-7558-4775-9eb3-8b99fc14655f.webp";
const product = {
  id, slug: "stolik", title: "Столик Пион", description: "Тестовый объект", category_name: "Мебель",
  dimensions: "5 × 7 см", materials: "Берёза", currency: "EUR", price_minor: 2499,
  ready_quantity: 1, made_to_order: true, requires_sketch: false, media: [],
};
let published = false;
let fail = false;
const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==", "base64");
const addresses = [];
const key = "sb_publishable_local_store_http_test";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return "http://127.0.0.1:" + server.address().port;
}
async function close(server) {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

const backend = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const json = (status, obj) => { res.writeHead(status, {"content-type":"application/json"}); res.end(JSON.stringify(obj)); };
  addresses.push(url.pathname);
  if (req.headers.apikey !== key) return json(401, { message: "Expected a local publishable key" });
  if (url.pathname === "/rest/v1/rpc/roomlet_catalog") {
    if (fail) return json(503, { message: "Backend unavailable" });
    const slug = url.searchParams.get("slug");
    return json(200, published && (!slug || slug === "eq." + product.slug) ? [product] : []);
  }
  const mediaBase = "/storage/v1/object/product-media/";
  const authMediaBase = "/storage/v1/object/authenticated/product-media/";
  if ([mediaBase,authMediaBase].some(prefix => url.pathname.startsWith(prefix))) {
    if (!published || !product.media.some(item => url.pathname.endsWith("/" + item.storage_path))) return json(404,{message:"unavailable"});
    res.writeHead(200, {"content-type":"image/webp"}); return res.end(webp);
  }
  json(404, {message:"Unknown fixture endpoint"});
});

const backendUrl = await listen(backend);
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: backendUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  ROOMLET_DEMO_MODE: "false", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
});
const networkFetch = globalThis.fetch;
// Guard against accidentally compiled-in hosted settings in a stale build.
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== "127.0.0.1") throw new Error("External network is disabled in the store HTTP check");
  return networkFetch(input, init);
};
let nextApp;
let frontend;
try {
  const next = (await import("next")).default;
  nextApp = next({dev: false});
  await nextApp.prepare();
  frontend = createServer(nextApp.getRequestHandler());
  const origin = await listen(frontend);
  const get = path => networkFetch(origin + path);
  const html = async path => (await get(path)).text();

  assert.match(await html("/catalog"), /В каталоге пока нет изделий/);
  assert.doesNotMatch(await html("/product/stolik"), /Столик Пион/);
  assert.equal((await get("/objects/atelier.webp")).status, 404);

  published = true;
  product.media = [{storage_path:id + "/" + cover, alt_text:"Фасад", sort_order:0}];
  const first = await html("/product/stolik");
  assert.match(first, /Столик Пион/);
  assert.match(first, /24,99/);
  assert.match(first, /Фасад/);
  assert.ok(first.includes("/catalog-media/" + id + "/" + cover));
  assert.doesNotMatch(first, /href="\/studio|\/objects\/atelier/);
  assert.match(await html("/"), /Столик Пион/);
  const photo = await get("/catalog-media/" + id + "/" + cover);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("content-type"), "image/webp");
  assert.match(photo.headers.get("cache-control"),/no-store/);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), webp);

  product.price_minor = 3011;
  product.media = [{storage_path:id + "/" + newCover, alt_text:"После обновления", sort_order:0}];
  const updated = await html("/product/stolik");
  assert.match(updated, /30,11/);
  assert.ok(updated.includes(newCover));
  assert.ok(!updated.includes(cover));
  assert.equal((await get("/catalog-media/" + id + "/" + cover)).status, 404);

  published = false;
  assert.match(await html("/catalog"), /В каталоге пока нет изделий/);
  assert.doesNotMatch(await html("/product/stolik"), /Столик Пион/);
  assert.equal((await get("/catalog-media/" + id + "/" + newCover)).status, 404);

  fail = true;
  const broken = await html("/catalog");
  assert.doesNotMatch(broken, /Столик Пион|Библиотека-ротонда|В каталоге пока нет изделий/);
  assert.ok(addresses.includes("/rest/v1/rpc/roomlet_catalog"));
  console.log("PASS: empty → publish → update price/photo → unpublish; private media, demo isolation and backend failure.");
} catch (error) {
  console.error("Store integration failed:", error.message.slice(0,180), "fixture requests:", addresses.join(", "));
  process.exitCode = 1;
} finally {
  await close(frontend);
  await nextApp?.close();
  await close(backend);
}
