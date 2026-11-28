import test from 'node:test';
import assert from 'node:assert/strict';
import { openLinkTicket, sealLinkTicket } from '../src/lib/telegram/link-ticket.ts';

test('transfer confirmation is bound to verified Telegram proof, owner session and expiry', () => {
  const ticket = { accountId: 'owner-uuid', telegramId: '12345', proof: 'a'.repeat(64), expiresAt: 1250 };
  const sealed = sealLinkTicket(ticket, 'test-only-signing-key');
  assert.deepEqual(openLinkTicket(sealed, 'test-only-signing-key', 'owner-uuid', 1000), ticket);
  assert.throws(() => openLinkTicket(sealed, 'different-key', 'owner-uuid', 1000));
  assert.throws(() => openLinkTicket(sealed, 'test-only-signing-key', 'different-account', 1000));
  assert.throws(() => openLinkTicket(sealed, 'test-only-signing-key', 'owner-uuid', 1250));
  assert.throws(() => openLinkTicket(sealed + '.extra', 'test-only-signing-key', 'owner-uuid', 1000));
  const tampered = Buffer.from(JSON.stringify({ ...ticket, telegramId: '54321' })).toString('base64url') + '.' + sealed.split('.')[1];
  assert.throws(() => openLinkTicket(tampered, 'test-only-signing-key', 'owner-uuid', 1000));
});
