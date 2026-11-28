import test from 'node:test';
import assert from 'node:assert/strict';
import {savedStorage} from '../src/features/store/saved-state.ts';
const memory=()=>{const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};};
test('guest favorites/cart transfer once; another account and logout do not inherit them',()=>{
  const disk=memory(),guest=savedStorage(disk,null);
  guest.favorite('library',true);guest.cart({slug:'library',mode:'ready',window:null},true);
  const owner=savedStorage(disk,'owner');owner.claimGuest();
  assert.deepEqual(owner.get().favorites,['library']);assert.equal(owner.get().cart.length,1);
  const pending=owner.pending();assert.equal(pending.length,2);
  owner.claimGuest();assert.equal(owner.pending().length,2);
  assert.deepEqual(savedStorage(disk,null).get().favorites,[]);
  const other=savedStorage(disk,'other');other.claimGuest();assert.deepEqual(other.get().favorites,[]);
  owner.ack(pending.map(op=>op.id),{favorites:['library'],cart:[{slug:'library',mode:'ready',window:null}]});
  assert.equal(owner.pending().length,0);
  assert.deepEqual(savedStorage(disk,'owner').get().favorites,['library']);
});
test('a response cannot discard changes made while synchronization was in flight',()=>{
  const store=savedStorage(memory(),'user');store.favorite('library',true);
  const sent=store.pending();store.favorite('library',false);store.favorite('cafe',true);
  store.ack(sent.map(op=>op.id),{favorites:['library'],cart:[]});
  assert.deepEqual(store.get().favorites,['cafe']);assert.equal(store.pending().length,2);
});
test('failed account write keeps guest transfer recoverable and private',()=>{
  const disk=memory(),guest=savedStorage(disk,null);guest.favorite('library',true);
  let fail=true;const flaky={...disk,setItem:(key:string,value:string)=>{if(fail&&key.includes('account:owner'))throw Error('quota');disk.setItem(key,value);}};
  const owner=savedStorage(flaky,'owner');assert.throws(()=>owner.claimGuest());
  const stranger=savedStorage(disk,'other');stranger.claimGuest();assert.deepEqual(stranger.get().favorites,[]);
  fail=false;owner.claimGuest();assert.deepEqual(owner.get().favorites,['library']);
});
test('an older response from another tab cannot replace a newer server snapshot',()=>{
  const disk=memory(),first=savedStorage(disk,'user'),second=savedStorage(disk,'user');
  first.favorite('library',true);const older=first.pending();
  second.favorite('cafe',true);const newer=second.pending();
  second.ack(newer.map(op=>op.id),{favorites:['library','cafe'],cart:[],revision:'2'});
  first.ack(older.map(op=>op.id),{favorites:['library'],cart:[],revision:'1'});
  assert.deepEqual(first.get().favorites,['library','cafe']);assert.equal(first.pending().length,0);
});
test('an interrupted journal cleanup does not prevent the next guest import',()=>{
  const disk=memory();savedStorage(disk,null).favorite('library',true);
  let fail=true;const flaky={...disk,setItem:(key:string,value:string)=>{if(fail&&key.endsWith('transfer:owner')&&value==='')throw Error('quota');disk.setItem(key,value);}};
  assert.throws(()=>savedStorage(flaky,'owner').claimGuest());fail=false;
  savedStorage(disk,null).favorite('cafe',true);
  const owner=savedStorage(flaky,'owner');owner.claimGuest();
  assert.deepEqual(owner.get().favorites,['library','cafe']);
  const other=savedStorage(disk,'other');other.claimGuest();assert.deepEqual(other.get().favorites,[]);
});
