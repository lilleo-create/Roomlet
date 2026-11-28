import 'server-only';
import { cookies } from 'next/headers';
import { openLinkTicket, sealLinkTicket, type LinkTicket } from './link-ticket';
import { hasMiniSession } from '@/lib/supabase/mini-cookies';
export const linkTicketCookie = '__Host-roomlet-telegram-link';
const secret = () => { if (!process.env.ROOMLET_TELEGRAM_SIGNING_KEY) throw Error('Linking unavailable'); return process.env.ROOMLET_TELEGRAM_SIGNING_KEY; };
export async function rememberLinkTicket(ticket: LinkTicket, mini = false) {
  (await cookies()).set(linkTicketCookie, sealLinkTicket(ticket, secret()), { httpOnly: true, secure: true, sameSite: mini ? 'none' : 'lax', partitioned: mini, path: '/', maxAge: Math.max(0, ticket.expiresAt - Math.floor(Date.now()/1000)) });
}
export async function readLinkTicket(accountId: string) {
  const raw = (await cookies()).get(linkTicketCookie)?.value;
  if (!raw) return null;
  try { return openLinkTicket(raw, secret(), accountId); } catch { return null; }
}
export async function clearLinkTicket() {
  const jar = await cookies();
  const mini = hasMiniSession(jar.getAll());
  jar.set(linkTicketCookie, '', { httpOnly: true, secure: true, sameSite: mini ? 'none' : 'lax', partitioned: mini, path: '/', maxAge: 0 });
}
