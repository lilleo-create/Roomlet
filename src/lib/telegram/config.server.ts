import "server-only";
import { issuerOrigin, signingKey } from "./assertion.server";

export const miniEnabled = () => process.env.ROOMLET_TELEGRAM_ENABLED === "true";

export function issuerConfig() {
  return {origin:issuerOrigin(process.env.ROOMLET_SITE_URL), keys:signingKey(process.env.ROOMLET_TELEGRAM_SIGNING_KEY ?? "")};
}
