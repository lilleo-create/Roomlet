import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Telegram receipts are atomic, persistent and unavailable to browser roles',async()=>{
  const db=new PGlite();
  try {
    await db.exec('create schema roomlet_private; create role anon; create role authenticated; create role service_role;');
    for(const file of ['20261127210548_telegram_launch_redemption.sql','20261128000028_telegram_webhook_receipts.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    const claim=()=>db.query('select public.claim_telegram_update(42) as claimed');
    assert.equal((await claim()).rows[0].claimed,true);
    assert.equal((await claim()).rows[0].claimed,false);
    await db.query("select public.finish_telegram_update(42,'sent')");
    assert.equal((await claim()).rows[0].claimed,false);
    assert.equal((await db.query('select status from roomlet_private.telegram_updates')).rows[0].status,'sent');
    const proof='a'.repeat(64);
    const redeem=()=>db.query("select public.consume_telegram_launch($1,now()+interval '1 minute') as redeemed",[proof]);
    assert.equal((await redeem()).rows[0].redeemed,true);
    assert.equal((await redeem()).rows[0].redeemed,false);
    for(const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      await assert.rejects(claim(),/permission denied/);
      await assert.rejects(redeem(),/permission denied/);
      await assert.rejects(db.query('select * from roomlet_private.telegram_updates'),/permission denied/);
      await db.exec('reset role');
    }
  } finally {await db.close();}
});
