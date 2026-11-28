import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('only owner can edit support; guests see only the contact and updates immediately',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create schema roomlet_private; create schema auth;
      create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.profiles(id uuid primary key,role text);
      insert into public.profiles values ('00000000-0000-4000-8000-000000000001','owner'),('00000000-0000-4000-8000-000000000002','maker'),('00000000-0000-4000-8000-000000000003','customer');
      create table public.workshop_settings(id integer primary key,timezone text);
      insert into public.workshop_settings values(1,'Asia/Tokyo');
      alter table public.workshop_settings enable row level security;`);
    const team=await readFile(new URL('../supabase/migrations/20261127161912_roomlet_team.sql',import.meta.url),'utf8');
    await db.exec(team.match(/create function roomlet_private\.require_owner\(\)[\s\S]+?\$\$;/)[0]);
    await db.exec(await readFile(new URL('../supabase/migrations/20261128002805_workshop_support_contact.sql',import.meta.url),'utf8'));
    for(const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      assert.equal((await db.query('select public.roomlet_support_username() as username')).rows[0].username,null);
      await assert.rejects(db.query('select timezone from public.workshop_settings'),/permission denied/);
      await assert.rejects(db.query("select public.save_workshop_support('hacker')"),/permission denied|owner required/i);
      await db.exec('reset role');
    }
    for(const id of ['2','3']) {
      await db.exec(`set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-00000000000${id}'`);
      await assert.rejects(db.query("select public.save_workshop_support('hacker')"),/owner required/i);
      await db.exec('reset role');
    }
    await db.exec("set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001'");
    await db.query("select public.save_workshop_support('Aksinia_atoM')");
    await assert.rejects(db.query("select public.save_workshop_support('https://evil.example')"),/invalid/i);
    await db.exec('reset role; set role anon');
    assert.equal((await db.query('select public.roomlet_support_username() as username')).rows[0].username,'Aksinia_atoM');
    await db.exec("reset role; set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001'");
    await db.query("select public.save_workshop_support('')");
    assert.equal((await db.query('select public.roomlet_support_username() as username')).rows[0].username,'');
  } finally {await db.close();}
});
