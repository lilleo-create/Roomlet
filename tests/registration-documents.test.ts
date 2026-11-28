import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationDocuments, registrationConsent } from '../src/features/profile/registration-documents.ts';

test('closed testing neither requires nor records fictitious legal consent', () => {
  assert.equal(registrationDocuments(null), null);
  const forged = new FormData(); forged.set('registration_consent', 'yes');
  assert.equal(registrationConsent(null, forged), null);
  assert.equal(registrationDocuments({ enabled: false }), null);
});
test('enabled consent requires both real document versions and explicit acceptance', () => {
  const config = { enabled: true, privacy: { url: 'https://example.test/privacy', version: 'p1' }, consent: { url: 'https://example.test/consent', version: 'c1' } };
  const documents = registrationDocuments(config)!;
  const form = new FormData();
  assert.throws(() => registrationConsent(documents, form));
  form.set('registration_consent', 'yes'); form.set('privacy_version', 'old'); form.set('consent_version', 'c1');
  assert.throws(() => registrationConsent(documents, form));
  form.set('privacy_version', 'p1');
  assert.deepEqual(registrationConsent(documents, form), { accepted: true, privacy_version: 'p1', consent_version: 'c1' });
  assert.throws(() => registrationDocuments({ ...config, consent: { url: 'javascript:alert(1)', version: 'x' } }));
  assert.throws(() => registrationDocuments({ enabled: true }));
});
