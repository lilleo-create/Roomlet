"use client";
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Dialog, Input } from '@/components/ui';
import { findTeamAccount, grantMaker, revokeMaker, type TeamLookup, type TeamAccount } from './actions';

function Submit({children}:{children:React.ReactNode}) {
  const {pending} = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Сохраняем…' : children}</Button>;
}
export function TeamAccess() {
  const [state,action,pending] = useActionState(findTeamAccount,{} as TeamLookup);
  const [selected,setSelected] = useState<TeamAccount|null>(null);
  return <>
    <form className="rs-team-form" action={action}>
      <Input label="Roomlet ID, Telegram ID или почта" name="identifier" autoComplete="off" maxLength={254} required
        hint="Идентификатор есть в настройках профиля участника. Почта должна быть подтверждена." />
      <Button type="submit" disabled={pending}>{pending ? 'Ищем…' : 'Найти участника'}</Button>
    </form>
    {state.error && <p role="alert">{state.error}</p>}
    {state.accounts && <ul className="rs-team-members" aria-label="Найденные участники">{state.accounts.map(account => <li key={account.user_id}>
      <div><strong>{account.display_name || account.email || 'Пользователь Roomlet'}</strong>
        {account.telegram_username && <span>@{account.telegram_username}</span>}
        <span>Roomlet ID: {account.user_id}</span>{account.telegram_id && <span>Telegram ID: {account.telegram_id}</span>}
        {account.email && <span>{account.email}</span>}</div>
      {account.member_role === 'customer' ? <Button type="button" variant="secondary" onClick={() => setSelected(account)}>Предоставить доступ</Button>
        : <span>{account.member_role === 'owner' ? 'Владелец мастерской' : 'Доступ уже открыт'}</span>}
    </li>)}</ul>}
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} title="Предоставить доступ мастера?">
      {selected && <><p><strong>{selected.display_name || selected.email || 'Пользователь Roomlet'}</strong> сможет управлять изделиями, заказами и настройками мастерской.</p>
        <p className="rs-team-identifier">Roomlet ID: {selected.user_id}{selected.telegram_id && <><br />Telegram ID: {selected.telegram_id}</>}</p>
        <form action={grantMaker}><input type="hidden" name="id" value={selected.user_id} /><input type="hidden" name="confirmed" value="yes" />
          <Submit>Подтвердить назначение</Submit></form></>}
    </Dialog>
  </>;
}

export function RevokeAccess({id,name}:{id:string;name:string}) {
  const [open,setOpen] = useState(false);
  return <><Button type="button" variant="secondary" onClick={() => setOpen(true)} aria-label={`Отозвать доступ у ${name}`}>Отозвать доступ</Button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Отозвать доступ к мастерской?">
      <p>{name} сохранит личный кабинет и заказы, но больше не сможет открывать Studio.</p>
      <form action={revokeMaker}><input type="hidden" name="id" value={id} /><Submit>Отозвать доступ</Submit></form>
    </Dialog></>;
}
