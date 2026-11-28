import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizationUrl, createWebFlow } from '../src/lib/telegram/oidc.ts';
import { authDestination } from '../src/features/profile/auth-paths.ts';
import { createHash } from 'node:crypto';

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
