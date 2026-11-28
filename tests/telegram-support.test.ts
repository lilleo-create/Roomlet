import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSupportUsername, resolveSupportUsername, supportLink } from '../src/lib/telegram/support.ts';

test('support accepts usernames, never arbitrary URLs or injected links',()=>{
  assert.equal(normalizeSupportUsername(' @Aksinia_atoM '),'Aksinia_atoM');
  assert.equal(normalizeSupportUsername(''),'');
  for(const invalid of ['@','https://t.me/tester','a/bcd','ab cd','abc','1user','a'.repeat(33),'test?x=1','@@tester'])
    assert.equal(normalizeSupportUsername(invalid),null);
  assert.equal(supportLink('Aksinia_atoM'),'https://t.me/Aksinia_atoM');
  assert.equal(supportLink('javascript:alert(1)'),null);
});
test('database takes priority; an explicitly cleared contact disables env fallback',()=>{
  assert.equal(resolveSupportUsername(null,'@fallback'),'fallback');
  assert.equal(resolveSupportUsername('SavedContact','fallback'),'SavedContact');
  assert.equal(resolveSupportUsername('','fallback'),null);
  assert.equal(resolveSupportUsername(null,'invalid/value'),null);
});
