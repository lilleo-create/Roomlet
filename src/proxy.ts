import {NextResponse, type NextRequest} from "next/server";
import {createServerClient} from "@supabase/ssr";
import {supabaseConfig} from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  if (Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL") && Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
    const {url,key} = supabaseConfig();
    const supabase = createServerClient(url,key,{cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll(values) {
        for (const {name,value} of values) request.cookies.set(name,value);
        response = NextResponse.next({request});
        for (const {name,value,options} of values) response.cookies.set(name,value,options);
      }
    }});
    await supabase.auth.getClaims();
  }
  response.headers.set("Cache-Control","private, no-store");
  return response;
}
export const config = {matcher:["/studio/:path*","/design-system/:path*","/profile/:path*"]};
