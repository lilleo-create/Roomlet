import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { createWebFlow, openWebFlow, sealWebFlow, verifyTelegramToken } from '../src/lib/telegram/oidc.ts';

test('OIDC cookie authenticates intent, account, state, nonce and expires', () => {
  const flow=createWebFlow('link','owner-uuid','/profile/settings',100);
  flow.allowTransfer=true;
  const secret='test-secret-with-sufficient-entropy';
  const cookie=sealWebFlow(flow,secret);
  assert.deepEqual(openWebFlow(cookie,secret,flow.state,101),flow);
  assert.throws(()=>openWebFlow(cookie,secret,'other-state',101));
  assert.throws(()=>openWebFlow(cookie+'x',secret,flow.state,101));
  assert.throws(()=>openWebFlow(cookie,secret,flow.state,401));
  assert.throws(()=>openWebFlow(cookie,'other-secret',flow.state,101));
});
test('official Telegram JWT maps signed numeric id to the same Mini App identity', async () => {
  const {privateKey,publicKey}=await generateKeyPair('RS256');
  const jwk=await exportJWK(publicKey);jwk.kid='test';
  const keys=createLocalJWKSet({keys:[jwk]});
  const token=await new SignJWT({id:12345,name:'Ирина',preferred_username:'irina',picture:'https://example.com/avatar.jpg',nonce:'nonce'})
    .setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://oauth.telegram.org').setAudience('9290085948')
    .setSubject('different-opaque-subject').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const launch=await verifyTelegramToken(token,'9290085948','nonce',keys);
  assert.equal(launch.telegramId,'12345');
  assert.equal(launch.photoUrl,'https://example.com/avatar.jpg');
  await assert.rejects(verifyTelegramToken(token,'wrong-audience','nonce',keys));
  await assert.rejects(verifyTelegramToken(token,'9290085948','wrong-nonce',keys), {code:'TELEGRAM_NONCE_MISMATCH'});
  const missingId=await new SignJWT({nonce:'nonce'}).setProtectedHeader({alg:'RS256',kid:'test'})
    .setIssuer('https://oauth.telegram.org').setAudience('9290085948').setSubject('12345').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  await assert.rejects(verifyTelegramToken(missingId,'9290085948','nonce',keys));
});

// A failed TCP connection must not consume an authorization code. Once TLS is
// established, an ambiguous failure must never resend the code automatically.
test('Telegram transport retries only failures before the secure connection', async () => {
  const { retryTelegramConnection } = await import('../src/lib/telegram/transport.ts');
  let calls=0;
  assert.equal(await retryTelegramConnection(async () => {
    calls++;
    if(calls<3) throw Object.assign(new Error('connect'),{beforeSecureConnection:true});
    return 'token';
  }),'token');
  assert.equal(calls,3);
  calls=0;
  await assert.rejects(retryTelegramConnection(async () => {calls++;throw new Error('response timeout');}));
  assert.equal(calls,1);
  calls=0;
  await assert.rejects(retryTelegramConnection(async () => {calls++;throw Object.assign(new Error('connect'),{beforeSecureConnection:true});}));
  assert.equal(calls,4);
});

test('Telegram transport decodes compressed JWKS and bounds the decoded response', async () => {
  const transport=await import('../src/lib/telegram/transport.ts');
  const {gzipSync,deflateSync,brotliCompressSync}=await import('node:zlib');
  assert.equal(typeof transport.decodeTelegramBody,'function','Compressed Telegram responses need decoding before JSON parsing');
  const body=Buffer.from(JSON.stringify({keys:[{kty:'RSA',kid:'telegram-public-key'}]}));
  for(const [encoding,bytes] of [['gzip',gzipSync(body)],['deflate',deflateSync(body)],['br',brotliCompressSync(body)],['identity',body]] as const) {
    assert.deepEqual(JSON.parse(transport.decodeTelegramBody(bytes,encoding)),JSON.parse(body.toString()));
  }
  assert.throws(()=>transport.decodeTelegramBody(gzipSync(Buffer.alloc(65537)), 'gzip'));
  assert.throws(()=>transport.decodeTelegramBody(Buffer.alloc(65537),undefined));
  assert.throws(()=>transport.decodeTelegramBody(Buffer.from('not gzip'),'gzip'));
  assert.throws(()=>transport.decodeTelegramBody(body,'unsupported'));
});
