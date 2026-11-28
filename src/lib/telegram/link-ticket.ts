import { createHmac, timingSafeEqual } from 'node:crypto';
export type LinkTicket = { accountId: string; telegramId: string; proof: string; expiresAt: number; trace?: string };
export function sealLinkTicket(ticket: LinkTicket, secret: string) {
  const body = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return body + '.' + createHmac('sha256', secret).update('telegram-link-confirmation:' + body).digest('base64url');
}
export function openLinkTicket(raw: string, secret: string, accountId: string, now = Math.floor(Date.now()/1000)): LinkTicket {
  if (raw.length > 2048) throw Error('Invalid confirmation');
  const [body, signature, extra] = raw.split('.');
  if (!body || !signature || extra) throw Error('Invalid confirmation');
  const expected = createHmac('sha256', secret).update('telegram-link-confirmation:' + body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error('Invalid confirmation');
  const ticket = JSON.parse(Buffer.from(body, 'base64url').toString()) as LinkTicket;
  if (ticket.accountId !== accountId || !/^[1-9][0-9]{0,15}$/.test(ticket.telegramId) || !/^[a-f0-9]{64}$/.test(ticket.proof) ||
    !Number.isSafeInteger(ticket.expiresAt) || ticket.expiresAt <= now || ticket.expiresAt > now + 360) throw Error('Expired confirmation');
  return ticket;
}
