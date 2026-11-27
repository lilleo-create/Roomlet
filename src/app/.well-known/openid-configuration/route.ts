import { issuerConfig } from "@/lib/telegram/config.server";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    const {origin} = issuerConfig();
    return Response.json({issuer:origin,jwks_uri:origin+"/api/telegram/jwks",
      authorization_endpoint:origin+"/api/telegram/oauth",token_endpoint:origin+"/api/telegram/oauth",
      response_types_supported:[],grant_types_supported:[],subject_types_supported:["public"],id_token_signing_alg_values_supported:["RS256"]});
  } catch { return new Response(null,{status:503}); }
}
