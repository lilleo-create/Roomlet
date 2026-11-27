// Requires a completed demo build and the two demo ports to be free.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";

const origin = "http://127.0.0.1:3211";
const api = "http://127.0.0.1:54331";
const email = "check-" + randomUUID() + "@roomlet.local";
const password = randomUUID();
const revised = randomUUID();
const cookies = new Map();
const captured = [];
const original = console.info;
console.info = (...args) => {
  const message = args.join(" ");
  if (message.includes("[@supabase/lite] email captured")) {
    if (message.includes("To: " + email)) captured.push(message);
    return;
  }
  original(...args);
};

async function request(path, options = {}) {
  const res = await fetch(origin + path, { ...options,redirect:"manual",headers:{
    ...options.headers, Cookie:[...cookies].map(([k,v]) => k + "=" + v).join("; "),
  } });
  for (const cookie of res.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const i = pair.indexOf("=");
    cookies.set(pair.slice(0,i),pair.slice(i+1));
  }
  return res;
}
async function submit(path, fields, receipt) {
  const html = receipt ?? await (await request(path)).text();
  const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)];
  const body = new FormData();
  const form = forms.find(m => m[1].includes('name="intent"'))?.[1];
  assert.ok(form, "missing native form");
  for (const [tag] of form.matchAll(/<input\s[^>]*>/g)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:$-]+)="([^"]*)"/g)]
      .map(([,key,value])=>[key,value.replaceAll("&quot;",'"').replaceAll("&amp;","&")]));
    if (attrs.type === "hidden") body.append(attrs.name,attrs.value || "");
  }
  for (const [name,value] of Object.entries(fields)) body.set(name,value);
  return request(path,{method:"POST",body,headers:{Origin:origin}});
}
async function callback(expected) {
  const link = captured.at(-1)?.match(/https?:\/\/[^\s<>]+/g)?.at(-1);
  assert.ok(link && new URL(link).origin === api, "local standard message link missing");
  const verify = await fetch(link,{redirect:"manual"});
  assert.equal(verify.status,303);
  const url = new URL(verify.headers.get("location"));
  assert.equal(url.origin,origin);
  assert.equal(url.pathname,expected);
  assert.ok(url.searchParams.has("local_proof"),"missing local SSR verification proof");
  return url.pathname + url.search;
}
const {closePreview} = await import("../../supabase/demo/runtime.mjs");
try {
  const next = "?next=%2Fcatalog%3Favailability%3Dmade";
  const signup = "/profile/register"+next;
  const receipt = await (await submit(signup,{ email,password })).text();
  assert.ok(receipt.includes("Проверьте почту"));
  assert.equal(captured.length,1);
  const cooldown = await (await submit(signup,{},receipt)).text();
  assert.ok(cooldown.includes("Подождите минуту"));
  assert.equal(captured.length,1);
  console.log("PASS registration and immediate resend cooldown");
  await wait(61_000);
  cookies.delete("roomlet-confirm-mail"); // Browser expires this 60-second cookie.
  const resent = await (await submit(signup,{},receipt)).text();
  assert.ok(resent.includes("Проверьте почту"));
  assert.equal(captured.length,2);
  const confirm = await callback("/profile/confirm");
  const confirmed = await submit(confirm,{});
  assert.equal(confirmed.headers.get("location"),"/catalog?availability=made");
  assert.ok((await (await request("/profile")).text()).includes("Покупатель"));
  console.log("PASS resent signup link, SSR confirmation, customer session and return");
  cookies.clear();
  const forgot = await (await submit("/profile/forgot"+next,{email})).text();
  assert.ok(forgot.includes("Проверьте почту"));
  assert.equal(captured.length,3);
  const recover = await callback("/profile/recover");
  const reset = await submit(recover,{password:revised});
  assert.match(reset.headers.get("location") || "",/success=recovered/);
  const reused = await (await submit(recover,{password:randomUUID()})).text();
  assert.ok(reused.includes("Код истёк"));
  const wrong = await (await submit("/profile/login",{email,password})).text();
  assert.ok(wrong.includes("Проверьте почту и пароль"));
  const signed = await submit("/profile/login"+next,{email,password:revised});
  assert.equal(signed.headers.get("location"),"/catalog?availability=made");
  console.log("PASS recovery link, password change, rejected replay and old password");
} catch (error) {
  process.exitCode = 1;
  console.error(error.message);
} finally {
  console.info = original;
  await closePreview();
}
