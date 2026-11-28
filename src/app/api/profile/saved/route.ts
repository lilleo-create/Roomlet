import {createRoomletClient} from '@/lib/supabase/server';
import {boundedText} from '@/lib/telegram/http.server';

export async function POST(request:Request) {
  const origin=request.headers.get('origin');
  const expected=process.env.ROOMLET_SITE_URL||new URL(request.url).origin;
  if(origin!==expected)return new Response(null,{status:403});
  const client=await createRoomletClient();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return new Response(null,{status:401});
  try {
    const input=JSON.parse(await boundedText(request,65536));
    // Explicit UUID prevents a delayed tab from writing its old user's queue
    // into a different account whose cookie was set in another tab.
    if(input.accountId!==user.id)return new Response(null,{status:409});
    const {data,error}=await client.rpc('roomlet_sync_saved_items',{p_operations:input.operations});
    if(error)return new Response(null,{status:400});
    return Response.json({accountId:user.id,state:data},{headers:{'Cache-Control':'private, no-store'}});
  } catch{return new Response(null,{status:400});}
}
