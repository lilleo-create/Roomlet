import { redirect } from 'next/navigation';
import { readAccount } from '@/features/profile/session';
import { emailGate } from '@/features/profile/email-link.server';
import { EmailLinkForm } from '@/features/profile/EmailLinkForm';
import type { EmailLinkState } from '@/features/profile/email-link-actions';
import '@/features/profile/auth.css';
export const metadata={title:'Подключить почту',robots:{index:false,follow:false}};
export default async function EmailLinkPage() {
  const account=await readAccount();
  if(!account) redirect('/profile/login?next=/profile/email');
  const gate=await emailGate(account.id,'read');
  const pending=gate.active;
  const initial:EmailLinkState=pending?{step:gate.phase==='old'?'old':gate.phase==='merge'?'merge':'code',email:gate.email,flow:gate.flow_id,retryAt:Date.parse(gate.retry_at)}:{step:'address',email:account.contactEmail||account.email};
  return <EmailLinkForm initial={initial} currentEmail={account.emailConfirmed?account.email:''} telegram={account.telegramLinked}/>;
}
