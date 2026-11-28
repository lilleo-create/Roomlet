import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizationUrl, createWebFlow } from '../src/lib/telegram/oidc.ts';
import { authDestination } from '../src/features/profile/auth-paths.ts';
import { createHash } from 'node:crypto';
import { profileContact,telegramPicture } from '../src/features/profile/contact.ts';

test('optional profile contacts are validated without creating login credentials',()=>{
  const form=new FormData();
  form.set('display_name',' Анна ');form.set('contact_phone','+7 (999) 123-45-67');
  assert.deepEqual(profileContact(form),{value:{display_name:'Анна',contact_email:null,contact_phone:'+79991234567'}});
  for(const phone of ['89991234567','+0','javascript:alert(1)']) {form.set('contact_phone',phone);assert.ok(profileContact(form).error);}
  form.set('contact_phone','');form.set('contact_email','bad');assert.ok(profileContact(form).error);
  form.set('contact_email','user@example.test');assert.equal(profileContact(form).value?.contact_email,'user@example.test');
  assert.equal(telegramPicture('javascript:alert(1)'),null);
  assert.equal(telegramPicture('https://user:pass@example.test/avatar'),null);
  assert.equal(telegramPicture('https://t.me/i/userpic.jpg'),'https://t.me/i/userpic.jpg');
});

test('Telegram redirects use PKCE, state and nonce without requesting phone or messaging permission',()=>{
  const flow=createWebFlow('login',null,'/catalog');
  const url=new URL(authorizationUrl(flow,'9290085948','https://roomlet.example/api/telegram/login/callback'));
  assert.equal(url.origin,'https://oauth.telegram.org');
  assert.equal(url.searchParams.get('scope'),'openid profile');
  assert.equal(url.searchParams.get('state'),flow.state);
  assert.equal(url.searchParams.get('nonce'),flow.nonce);
  assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(flow.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.has('client_secret'),false);
  for(const unsafe of ['https://evil.example','//evil.example','/api/telegram/login?intent=link','/studio/team','/profile/telegram?next=//evil.example'])
    assert.ok(['/profile','/profile/telegram'].includes(authDestination(unsafe)));
  assert.equal(authDestination('/catalog'),'/catalog');
  assert.equal(authDestination('/profile/telegram'),'/profile/telegram');
});
