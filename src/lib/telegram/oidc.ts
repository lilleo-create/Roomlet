import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, customFetch, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { telegramRequest } from './transport.ts';
import type { TelegramLaunch } from './init-data.server.ts';

const issuer='https://oauth.telegram.org';
const telegramKeys=createRemoteJWKSet(new URL(issuer+'/.well-known/jwks.json'),{[customFetch]:()=>telegramRequest('/.well-known/jwks.json')});
export type WebFlow={intent:'login'|'link'|'disconnect-email';accountId:string|null;next:string;state:string;nonce:string;verifier:string;expiresAt:number;allowTransfer?:boolean;trace?:string};
export function createWebFlow(intent:WebFlow['intent'],accountId:string|null,next:string,now=Math.floor(Date.now()/1000)):WebFlow {
  return {intent,accountId,next,state:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url'),verifier:randomBytes(32).toString('base64url'),expiresAt:now+300,trace:randomUUID().slice(0,8)};
}
export function sealWebFlow(flow:WebFlow,secret:string) {
  const payload=Buffer.from(JSON.stringify(flow)).toString('base64url');
  return payload+'.'+createHmac('sha256',secret).update('telegram-flow:'+payload).digest('base64url');
}
export function openWebFlow(raw:string,secret:string,state:string,now=Math.floor(Date.now()/1000)):WebFlow {
  if(raw.length>4096) throw Error('Invalid flow');
  const [payload,signature,extra]=raw.split('.');
  if(!payload || !signature || extra!==undefined) throw Error('Invalid flow');
  const expected=createHmac('sha256',secret).update('telegram-flow:'+payload).digest();
  const actual=Buffer.from(signature,'base64url');
  if(actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw Error('Invalid flow');
  const flow=JSON.parse(Buffer.from(payload,'base64url').toString()) as WebFlow;
  if(flow.state!==state || !['login','link','disconnect-email'].includes(flow.intent) || !Number.isSafeInteger(flow.expiresAt) ||
    now>=flow.expiresAt || flow.expiresAt>now+300 || !/^[\w-]{43}$/.test(flow.verifier) || !/^[\w-]{43}$/.test(flow.nonce)) throw Error('Invalid flow');
  return flow;
}
export function authorizationUrl(flow:WebFlow,clientId:string,callback:string) {
  const url=new URL(issuer+'/auth');
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',scope:'openid profile',
    state:flow.state,nonce:flow.nonce,code_challenge:createHash('sha256').update(flow.verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  return url.href;
}
export async function verifyTelegramToken(token:string,clientId:string,nonce:string,keys:JWTVerifyGetKey=telegramKeys,onVerified?:(stage:'token-signature-claims'|'token-nonce'|'token-identity')=>void):Promise<TelegramLaunch> {
  const {payload}=await jwtVerify(token,keys,{issuer,audience:clientId,algorithms:['RS256'],requiredClaims:['sub','iat','exp','nonce','id'],maxTokenAge:'5m',clockTolerance:10});
  onVerified?.('token-signature-claims');
  if(payload.nonce!==nonce) throw Object.assign(Error('Invalid Telegram nonce'),{code:'TELEGRAM_NONCE_MISMATCH'});
  onVerified?.('token-nonce');
  // Telegram's OIDC endpoint can serialize the signed profile ID as a decimal
  // string. Preserve its exact value and the existing Mini App identity key.
  // Do not use the opaque OIDC sub, username or permissive numeric coercion.
  const telegramId=typeof payload.id==='number' && Number.isSafeInteger(payload.id) && payload.id>0 ? String(payload.id)
    : typeof payload.id==='string' && /^[1-9][0-9]{0,15}$/.test(payload.id) && BigInt(payload.id)<=BigInt(Number.MAX_SAFE_INTEGER) ? payload.id : null;
  if(!telegramId) throw Object.assign(Error('Invalid Telegram identity'),{code:'TELEGRAM_ID_INVALID'});
  onVerified?.('token-identity');
  const photo=typeof payload.picture==='string' && payload.picture.length<=2048 && URL.canParse(payload.picture)?new URL(payload.picture):null;
  return {telegramId,displayName:typeof payload.name==='string'?payload.name.slice(0,256):null,
    username:typeof payload.preferred_username==='string'?payload.preferred_username.slice(0,64):null,
    photoUrl:photo?.protocol==='https:' && !photo.username && !photo.password?photo.href:null,languageCode:null,
    expiresAt:Math.min(payload.exp!,Math.floor(Date.now()/1000)+300),
    replayKey:createHash('sha256').update('telegram-oidc:'+token).digest('hex')};
}
