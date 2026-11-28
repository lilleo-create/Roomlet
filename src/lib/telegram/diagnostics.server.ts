import 'server-only';
import { randomUUID } from 'node:crypto';
// Never log provider bodies, URLs, cookies, JWTs, user IDs, names, or emails.
export function telegramFailure(stage: string, code?: string, status?: number) {
  const reference = randomUUID().slice(0,8);
  console.error('[telegram-auth]', JSON.stringify({ reference, stage, code: code && /^[A-Za-z0-9_]{1,60}$/.test(code) ? code : 'unknown', status }));
  return reference;
}
