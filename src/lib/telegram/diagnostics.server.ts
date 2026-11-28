import 'server-only';
import { randomUUID } from 'node:crypto';
// Never log provider bodies, URLs, cookies, JWTs, user IDs, names, or emails.
export function telegramTrace(reference: string, stage: string, outcome: 'ok'|'begin'|'required'|'rejected' = 'ok') {
  if (!/^[a-f0-9]{8}$/.test(reference) || !/^[a-z-]{1,60}$/.test(stage)) return;
  console.info('[telegram-auth]', JSON.stringify({reference,stage,outcome}));
}
export function telegramFailure(stage: string, code?: string, status?: number, trace?: string) {
  const reference = trace && /^[a-f0-9]{8}$/.test(trace) ? trace : randomUUID().slice(0,8);
  console.error('[telegram-auth]', JSON.stringify({ reference, stage, code: code && /^[A-Za-z0-9_]{1,60}$/.test(code) ? code : 'unknown', status }));
  return reference;
}
