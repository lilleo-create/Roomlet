export type RegistrationDocuments = { privacy: { url: string; version: string }; consent: { url: string; version: string } };

export function registrationDocuments(value: unknown): RegistrationDocuments | null {
  if (!value || typeof value !== 'object' || !('enabled' in value) || value.enabled !== true) return null;
  const config = value as Record<string, unknown>;
  for (const key of ['privacy', 'consent']) {
    const document = config[key] as Record<string, unknown> | undefined;
    if (!document || typeof document.version !== 'string' || !document.version.trim() || document.version.length > 100 ||
      typeof document.url !== 'string' || document.url.length > 2048) throw Error('Юридические документы пока не настроены.');
    const url = new URL(document.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('Юридические документы пока не настроены.');
  }
  return { privacy: config.privacy, consent: config.consent } as RegistrationDocuments;
}

export function registrationConsent(documents: RegistrationDocuments | null, form: FormData) {
  if (!documents) return null; // Closed testing: no documents, no invented consent record.
  if (form.get('registration_consent') !== 'yes' || form.get('privacy_version') !== documents.privacy.version ||
    form.get('consent_version') !== documents.consent.version) throw Error('Ознакомьтесь с документами и подтвердите согласие.');
  return { privacy_version: documents.privacy.version, consent_version: documents.consent.version, accepted: true };
}
