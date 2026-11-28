import "server-only";
import { issuerOrigin, signingKey } from "./assertion.server";

export const miniEnabled = () => process.env.ROOMLET_TELEGRAM_ENABLED === "true";
// Web linking can be enabled before opening Mini App signups to the owner.
export const webTelegramEnabled = () => Boolean(process.env.TELEGRAM_OIDC_CLIENT_ID && process.env.TELEGRAM_OIDC_CLIENT_SECRET && process.env.ROOMLET_TELEGRAM_SIGNING_KEY);

export function webTelegramConfig() {
  if(!webTelegramEnabled()) throw Error('Telegram Login is not configured');
  const {origin}=issuerConfig();
  return {origin,clientId:process.env.TELEGRAM_OIDC_CLIENT_ID!,clientSecret:process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
    flowSecret:process.env.ROOMLET_TELEGRAM_SIGNING_KEY!,callback:origin+'/api/telegram/login/callback'};
}

export function issuerConfig() {
  return {origin:issuerOrigin(process.env.ROOMLET_SITE_URL), keys:signingKey(process.env.ROOMLET_TELEGRAM_SIGNING_KEY ?? "")};
}
