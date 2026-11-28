"use client";
import { useActionState, useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { Button, Input } from '@/components/ui';
import { saveProfile, type ProfileSaveState } from '@/app/(store)/profile/actions';
import { requestContactConfirmation, type ContactConfirmationState } from './contact-actions';

export function ProfileSettingsForm({ name, email, phone, avatar, confirmedEmail }: {
  name: string; email: string; phone: string; avatar: string | null; confirmedEmail: string;
}) {
  const [values,setValues] = useState({name,email,phone});
  const [state,action,pending] = useActionState(saveProfile,{} as ProfileSaveState);
  const baseline = state.saved ?? {name,email,phone};
  const dirty = values.name.trim() !== baseline.name || values.email.trim() !== baseline.email ||
    values.phone.trim().replace(/[\s().-]/g,'') !== baseline.phone;
  const update = (field: keyof typeof values, value: string) => setValues(previous => ({...previous,[field]:value}));
  return <form action={action} className="profile-settings-form" aria-busy={pending}>
    <ProfileAvatar src={avatar} className="profile-settings-avatar" />
    <Input label="Имя" name="display_name" autoComplete="name" maxLength={100}
      value={values.name} onChange={event => update('name',event.target.value)} />
    <Input label="Электронная почта" name="contact_email" type="email" autoComplete="email" maxLength={254}
      value={values.email} placeholder={confirmedEmail || 'Для связи с мастерской'} onChange={event => update('email',event.target.value)}
      hint={confirmedEmail && (!values.email || values.email.toLowerCase() === confirmedEmail.toLowerCase()) ? 'Почта для входа подтверждена.' : 'Контактная почта. Подтверждение — в способах входа.'} />
    <Input label="Телефон" name="contact_phone" type="tel" autoComplete="tel" maxLength={32}
      value={values.phone} onChange={event => update('phone',event.target.value)} hint="С кодом страны" />
    {state.error && <p role="alert" className="profile-settings-error">{state.error}</p>}
    <Button className="profile-settings-save" type="submit" disabled={pending || !dirty}>{pending ? 'Сохраняем…' : 'Сохранить изменения'}</Button>
    <p className="profile-settings-feedback" role="status">{pending ? '' : !dirty ? state.saved ? 'Изменения сохранены' : 'Нет несохранённых изменений' : 'Есть несохранённые изменения'}</p>
  </form>;
}

export function ConfirmContactEmail({ email }: { email: string }) {
  const [state,action,pending] = useActionState(requestContactConfirmation,{} as ContactConfirmationState);
  return <form action={action} className="profile-settings-confirm" aria-busy={pending}>
    <p>{email ? <>Контакт: <strong>{email}</strong>. Пока не подтверждён.</> : 'Добавьте и сохраните почту в личных данных.'}</p>
    {email && <Button variant="secondary" type="submit" disabled={pending || Boolean(state.sent)}>{pending ? 'Отправляем…' : 'Подтвердить почту'}</Button>}
    {state.error && <p role="alert">{state.error}</p>}
    {state.sent && <p role="status">Запрос принят. Откройте ссылку из письма в этом браузере. До подтверждения вход по этому адресу недоступен.</p>}
  </form>;
}
