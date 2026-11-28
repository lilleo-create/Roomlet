"use client";
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { normalizeSupportUsername, supportLink } from '@/lib/telegram/support';

function SaveContact({invalid}:{invalid:boolean}) {
  const {pending}=useFormStatus();
  return <button className="rs-primary" disabled={pending || invalid}>{pending?'Сохраняем…':'Сохранить контакт'}</button>;
}
export function Communications({initialValue,editable,action}:{initialValue:string;editable:boolean;action:(data:FormData)=>Promise<void>}) {
  const [value,setValue]=useState(initialValue);
  const normalized=normalizeSupportUsername(value);
  const url=supportLink(normalized);
  return <form action={action} className="rs-settings-form">
    <h2>Коммуникации</h2>
    <label>Telegram-аккаунт поддержки<input name="telegram_support_username" value={value} onChange={event=>setValue(event.target.value)}
      placeholder="@username" readOnly={!editable} maxLength={33} autoCapitalize="none" autoComplete="off" spellCheck={false}
      aria-invalid={normalized===null} aria-describedby="support-hint" /></label>
    <p id="support-hint">{normalized===null?'От 5 до 32 символов: латинские буквы, цифры и _. Первый символ — буква.'
      :editable?'Контакт для магазина и команды /support. Пустое поле отключает связь.':'Контакт изменяет владелец мастерской.'}</p>
    {url?<p><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Проверить ссылку Telegram">{url} ↗</a></p>
      :normalized!==null?<p>Связь с мастерской пока недоступна.</p>:null}
    {editable && <SaveContact invalid={normalized===null} />}
  </form>;
}
