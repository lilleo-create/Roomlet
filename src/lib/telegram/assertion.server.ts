import { createHash, createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";
import type { TelegramLaunch } from "./init-data.server.ts";

export const provider = "custom:roomlet-telegram";
export const audience = "roomlet-mini-app";

export function issuerOrigin(value: string | undefined) {
  if (!value) throw Error("Missing issuer origin");
  const origin = new URL(value);
  if (origin.protocol !== "https:" || origin.origin !== value) throw Error("Invalid issuer origin");
  return origin.origin;
}

export function signingKey(encoded: string) {
  const key = createPrivateKey(Buffer.from(encoded, "base64"));
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
    throw Error("Expected RSA signing key of at least 2048 bits");
  const publicKey = createPublicKey(key);
  const kid = createHash("sha256").update(publicKey.export({type:"spki",format:"der"})).digest("base64url");
  return {key, jwk: {...publicKey.export({format:"jwk"}), alg:"RS256", use:"sig", kid}};
}

export function createAssertion(launch: TelegramLaunch, origin: string, keys: ReturnType<typeof signingKey>, now = Math.floor(Date.now()/1000)) {
  if (launch.expiresAt <= now) throw Error("Expired launch");
  const nonce = randomBytes(32).toString("base64url");
  const header = { alg:"RS256", typ:"JWT", kid:keys.jwk.kid };
  const claims = { iss:issuerOrigin(origin), sub:"tg:" + launch.telegramId, aud:audience, iat:now,
    exp:Math.min(launch.expiresAt, now+60), nonce:createHash("sha256").update(nonce).digest("hex"),
    ...(launch.displayName && {name:launch.displayName}) };
  const payload = [header, claims].map(value=>Buffer.from(JSON.stringify(value)).toString("base64url")).join(".");
  return {provider, nonce, token: payload + "." + sign("RSA-SHA256",Buffer.from(payload),keys.key).toString("base64url")};
}

export function recentlyAuthenticated(amr: unknown, now = Math.floor(Date.now()/1000)) {
  return Array.isArray(amr) && amr.some(entry => entry?.method === "password" &&
    Number.isSafeInteger(entry.timestamp) && entry.timestamp <= now && now-entry.timestamp < 300);
}
