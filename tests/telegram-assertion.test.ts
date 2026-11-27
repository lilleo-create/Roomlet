import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { createAssertion, issuerOrigin, recentlyAuthenticated, signingKey } from "../src/lib/telegram/assertion.server.ts";

test("Telegram assertion is audience-bound, nonce-bound and discloses no roles, email or private key",()=>{
  const {privateKey} = generateKeyPairSync("rsa",{modulusLength:2048});
  const keys = signingKey(Buffer.from(privateKey.export({format:"pem",type:"pkcs8"})).toString("base64"));
  const launch = {telegramId:"4310",displayName:"Ирина",username:null,languageCode:null,photoUrl:null,expiresAt:150,replayKey:"hash"};
  const issue = () => createAssertion(launch,"https://shop.example",keys,100);
  const assertion = issue();
  const [header,payload,signature] = assertion.token.split(".");
  assert.equal(JSON.parse(Buffer.from(header,"base64url").toString()).kid,keys.jwk.kid);
  assert.equal(keys.jwk.d,undefined);
  assert.ok(verify("RSA-SHA256",Buffer.from(header+"."+payload),createPublicKey({key:keys.jwk,format:"jwk"}),Buffer.from(signature,"base64url")));
  assert.deepEqual(JSON.parse(Buffer.from(payload,"base64url").toString()),{
    iss:"https://shop.example",sub:"tg:4310",aud:"roomlet-mini-app",iat:100,exp:150,
    nonce:createHash("sha256").update(assertion.nonce).digest("hex"),name:"Ирина",
  });
  assert.notEqual(issue().nonce,assertion.nonce);
  assert.throws(()=>createAssertion(launch,"https://shop.example",keys,150));
  for (const origin of ["http://shop.example","https://shop.example/path","https://me:pw@shop.example"]) assert.throws(()=>issuerOrigin(origin));
});

test("linking requires a recent password authentication for the current account",()=>{
  assert.ok(recentlyAuthenticated([{method:"password",timestamp:100}],399));
  for (const amr of [null,["password"],[{method:"oauth",timestamp:400}],[{method:"password",timestamp:100}],[{method:"password",timestamp:401}]])
    assert.equal(recentlyAuthenticated(amr,400),false);
});
