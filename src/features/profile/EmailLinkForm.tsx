'use client';
import Link from 'next/link';
import { useActionState,useEffect,useState } from 'react';
import { ArrowLeft,ArrowRight,Mail,Check,Eye,EyeOff } from 'lucide-react';
import { Button } from '@/components/ui';
import { Checkbox } from '@/components/Checkbox';
import { AuthField } from './AuthField';
import { submitEmailLink,saveLinkedPassword,type EmailLinkState } from './email-link-actions';

export function EmailLinkForm({initial,currentEmail,telegram}:{initial:EmailLinkState;currentEmail:string;telegram:boolean}) {
  const [state,action,pending]=useActionState(submitEmailLink,initial);
  const [editing,setEditing]=useState(false),[entered,setEntered]=useState({step:initial.step,value:''}),[agreed,setAgreed]=useState(false),[seconds,setSeconds]=useState(0);
  useEffect(()=>{const tick=()=>setSeconds(Math.max(0,Math.ceil(((state.retryAt??0)-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[state.retryAt]);
  const step=editing?'address':state.step;
  const code=entered.step===step?entered.value:'';
  const title=step==='address'?(currentEmail?'Изменить почту':'Подключить почту'):step==='success'?'Почта подключена':step==='merge'?'Один аккаунт Roomlet':'Подтвердите адрес';
  return <section className="account-page">
    <div className="account-top"><Link href="/" className="store-logo" aria-label="Roomlet — главная">roomlet<span aria-hidden>.</span></Link><Link href="/profile/settings" className="account-back" aria-label="Настройки профиля"><ArrowLeft size={20}/></Link></div>
    <div className="email-link-icon" aria-hidden>{step==='success'?<Check size={38} strokeWidth={1.4}/>:<Mail size={40} strokeWidth={1.3}/>}</div>
    <div className="account-layout"><header className="account-heading"><h1>{title}</h1><p>{step==='address'?'Для входа и восстановления доступа. Подтвердите адрес кодом из письма.':step==='old'?<>Новый адрес подтверждён. Введите код из письма на прежнюю почту <strong>{currentEmail}</strong>.</>:step==='code'?<>Введите код из письма на <strong>{state.email}</strong>.</>:step==='merge'?'Адрес подтверждён. У вас уже есть аккаунт с этой почтой.':<>Адрес <strong>{state.email}</strong> подтверждён.{telegram?' Telegram остаётся подключён.':''}</>}</p></header>
      {step==='success'?<><PasswordSetup/><Link className="account-text-link" href="/profile/settings">Вернуться в настройки</Link></>:<>
      <form action={action} onSubmit={()=>setEditing(false)} className="account-form" aria-busy={pending}>
        <input type="hidden" name="flow" value={state.flow??''}/>
        <input type="hidden" name="intent" value={step==='address'?'send':step==='merge'?'merge':'verify'}/>
        {step==='address'?<><AuthField label="Электронная почта" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={state.email}/>
          {currentEmail&&<AuthField label="Текущий пароль" type="password" name="current_password" autoComplete="current-password" required maxLength={128}/>}</>
        :step==='merge'?<Checkbox name="allow_transfer" value="yes" checked={agreed} onChange={e=>setAgreed(e.target.checked)}><span><strong>Объединить мои аккаунты</strong><br/>Сохранить аккаунт с почтой, перенести в него Telegram, заказы и заявки.</span></Checkbox>
        :<div className="email-otp"><label htmlFor="email-link-code">Код подтверждения</label><div className="email-otp-control"><div className="email-otp-cells" aria-hidden>{Array.from({length:6},(_,i)=><span key={i} data-active={code.length===i}>{code[i]??''}</span>)}</div><input id="email-link-code" name="otp" value={code} onChange={e=>setEntered({step:state.step,value:e.target.value.replace(/\D/g,'').slice(0,6)})} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required aria-describedby="otp-help" autoFocus/></div><p id="otp-help">Код действует 10 минут. Никому его не сообщайте.</p></div>}
        {state.error&&<p role="alert" className="account-error">{state.error}</p>}
        <Button type="submit" disabled={pending||(step==='merge'&&!agreed)||(['code','old'].includes(step)&&code.length!==6)}>{pending?'Подождите…':step==='address'?'Получить код':step==='merge'?'Объединить аккаунты':'Подтвердить'}{!pending&&<ArrowRight size={16}/>}</Button>
      </form>
      {['code','old'].includes(step)&&<><form action={action} className="account-form"><input name="intent" type="hidden" value="send"/><input name="email" type="hidden" value={state.email}/>{!currentEmail&&<button className="account-text-link email-link-plain" disabled={pending||seconds>0} type="submit">{seconds>0?`Отправить повторно через ${seconds} с`:'Отправить код повторно'}</button>}</form><button className="account-text-link email-link-plain" type="button" onClick={()=>{setEditing(true);setEntered({step:'address',value:''});}}>Изменить адрес{currentEmail?' или получить новый код':''}</button></>}
      </>}
    </div>
  </section>;
}
function PasswordSetup() {
  const [state,action,pending]=useActionState(saveLinkedPassword,{} as {error?:string;saved?:boolean});
  const [show,setShow]=useState(false);
  if(state.saved) return <p role="status" className="account-notice">Пароль сохранён. Теперь можно входить по почте.</p>;
  return <form action={action} className="account-form" aria-busy={pending}><p className="account-link-copy">При желании установите пароль для входа по почте.</p><div className="account-password"><AuthField label="Новый пароль" type={show?'text':'password'} name="password" autoComplete="new-password" required minLength={8} maxLength={128}/><button className="account-eye" type="button" aria-label={show?'Скрыть пароль':'Показать пароль'} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{state.error&&<p role="alert" className="account-error">{state.error} <Link href="/profile/forgot?next=/profile/settings">Восстановить доступ</Link></p>}<Button type="submit" disabled={pending}>{pending?'Сохраняем…':'Установить пароль'}</Button></form>;
}
