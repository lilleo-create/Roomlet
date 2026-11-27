import { issuerConfig } from "@/lib/telegram/config.server";
export const dynamic = "force-dynamic";
export function GET() {
  try { return Response.json({keys:[issuerConfig().keys.jwk]}); }
  catch { return new Response(null,{status:503}); }
}
