import 'server-only';
import { createCatalogClient } from '@/lib/supabase/public';
import { resolveSupportUsername } from './support';

/** Fresh read per request; expose only the public contact, never workshop settings. */
export async function readSupportUsername() {
  try {
    const client=await createCatalogClient();
    const {data,error}=await client.rpc('roomlet_support_username');
    if(error || (data!==null && typeof data!=='string')) return null;
    return resolveSupportUsername(data,process.env.TELEGRAM_SUPPORT_USERNAME);
  } catch {return null;}
}
