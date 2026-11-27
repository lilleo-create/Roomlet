// The Mini App uses the native ID-token grant at Supabase. Web redirects are disabled.
export function GET() { return Response.json({error:"unsupported_response_type"},{status:400}); }
export function POST() { return Response.json({error:"unsupported_grant_type"},{status:400}); }
