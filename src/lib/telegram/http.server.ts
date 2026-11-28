import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/supabase/config';

export function telegramAdmin() {
  const {url}=supabaseConfig();
  const key=process.env.SUPABASE_SECRET_KEY;
  if (!key) throw Error('Telegram backend is not configured');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function boundedText(request:Request, limit:number) {
  if (!request.body) throw Error('Missing body');
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    while(true) {
      const {value,done}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>limit) {await reader.cancel();throw Error('Body too large');}
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {reader.releaseLock();}
}
