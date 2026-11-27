import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

// A private local ledger keeps the hosted schema and the demo overlay independently versioned.
export async function migratePreview(db) {
  await db.exec(`create schema if not exists roomlet_demo_runtime;
    revoke all on schema roomlet_demo_runtime from public, anon, authenticated;
    create table if not exists roomlet_demo_runtime.migrations(name text primary key, checksum text not null)`);
  const dir = new URL("../migrations/", import.meta.url);
  const entries = (await readdir(dir)).filter(name=>/^\d{14}_.+\.sql$/.test(name)).sort()
    .map(name=>({name, file:new URL(name,dir)}));
  entries.push({name:"demo/catalog.sql", file:new URL("./catalog.sql",import.meta.url)});
  for (const {name,file} of entries) {
    const text = (await readFile(file,"utf8")).replace(/\r\n/g,"\n");
    const checksum=createHash("sha256").update(text).digest("hex");
    const previous=(await db.query("select checksum from roomlet_demo_runtime.migrations where name=$1",[name])).rows[0];
    if (previous) {
      if(previous.checksum!==checksum) throw new Error("Applied local migration changed: "+name);
      continue;
    }
    // Registered alongside the SQL in one transaction. Individual migration files may
    // already contain an outer BEGIN/COMMIT, which is owned by this transaction here.
    const body = text.replace(/^(\s*(?:--[^\n]*\n\s*)*)begin\s*;/i,"$1").replace(/\bcommit\s*;\s*$/i,"");
    await db.transaction(async tx=>{
      await tx.exec(body);
      await tx.query("insert into roomlet_demo_runtime.migrations(name,checksum) values($1,$2)",[name,checksum]);
    });
  }
}
