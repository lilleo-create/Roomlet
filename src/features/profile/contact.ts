export function profileContact(form: FormData) {
  const name = String(form.get('display_name') ?? '').trim();
  const email = String(form.get('contact_email') ?? '').trim();
  const phone = String(form.get('contact_phone') ?? '').trim().replace(/[\s().-]/g, '');
  if (Array.from(name).length > 100) return { error: 'Сократите имя до 100 символов.' };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    return { error: 'Проверьте адрес электронной почты.' };
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone))
    return { error: 'Укажите номер с кодом страны, например +7 999 123-45-67.' };
  return { value: { display_name: name, contact_email: email || null, contact_phone: phone || null } };
}

export function telegramPicture(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
