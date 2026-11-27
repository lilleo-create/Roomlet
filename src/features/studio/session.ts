import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "roomlet_demo_studio";
const maxAge = 8 * 3600;
const processState = globalThis as typeof globalThis & { roomletDemoSecret?: Buffer };
const secret = processState.roomletDemoSecret ??= randomBytes(32);

function signature(timestamp: string) {
  return createHmac("sha256", secret).update(timestamp).digest("hex");
}
export async function beginDemo() {
  const expiry = String(Math.floor(Date.now() / 1000) + maxAge);
  const jar = await cookies();
  const isHttps = (await headers()).get("x-forwarded-proto") === "https";
  jar.set(cookieName, expiry + "." + signature(expiry), {httpOnly: true, secure: isHttps, sameSite:"lax", path:"/studio", maxAge});
}
export async function endDemo() {
  (await cookies()).set(cookieName, "", {path:"/studio", maxAge:0, httpOnly:true, sameSite:"lax"});
}
const isDemo = cache(async () => {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^\d{10}\.[a-f\d]{64}$/.test(token)) return false;
  const [timestamp, mac] = token.split(".");
  return Number(timestamp) > Date.now()/1000 && timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(timestamp), "hex"));
});
const destinations = {today:"/studio", calendar:"/studio/calendar", orders:"/studio/orders", products:"/studio/products"} as const;
export type StudioSection = keyof typeof destinations;
export function studioDestination(value: unknown) {
  return typeof value === "string" && Object.hasOwn(destinations, value) ? destinations[value as StudioSection] : destinations.today;
}
export async function requireDemo(section: StudioSection) {
  if (!await isDemo()) redirect("/studio/login?next=" + section);
}
