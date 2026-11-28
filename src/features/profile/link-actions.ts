"use server";
import { redirect } from 'next/navigation';
import { createRoomletClient } from '@/lib/supabase/server';
import { recentlyAuthenticated } from '@/lib/telegram/assertion.server';
import { readLinkTicket, clearLinkTicket } from '@/lib/telegram/link-ticket.server';
import { telegramAdmin } from '@/lib/telegram/http.server';
import { telegramFailure, telegramTrace } from '@/lib/telegram/diagnostics.server';

export async function confirmTelegramTransfer(_state: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const client = await createRoomletClient();
  const { data: { user } } = await client.auth.getUser();
  const { data } = await client.auth.getClaims();
  if (!user?.email_confirmed_at || !user.email || data?.claims.sub !== user.id || !recentlyAuthenticated(data.claims.amr))
    redirect('/profile/login?next=/profile/telegram');
  if (form.get('allow_transfer') !== 'yes') return { error: 'Подтвердите объединение аккаунтов.' };
  const ticket = await readLinkTicket(user.id);
  if (!ticket) return { error: 'Время подтверждения истекло. Подключите Telegram ещё раз.' };
  if(ticket.trace) telegramTrace(ticket.trace,'merge-consent-verified');
  const result = await telegramAdmin().rpc('roomlet_transfer_telegram', { p_target: user.id, p_telegram_id: ticket.telegramId, p_proof_hash: ticket.proof });
  if (result.error || result.data !== true) {
    const reference = telegramFailure('confirmed-transfer', result.error?.code,undefined,ticket.trace);
    return { error: `Не удалось объединить аккаунты. Данные сохранены. Код обращения: ${reference}.` };
  }
  if(ticket.trace) telegramTrace(ticket.trace,'account-transfer-committed');
  await clearLinkTicket();
  const refreshed=await client.auth.refreshSession();
  if(refreshed.error || refreshed.data.user?.id!==user.id) {
    telegramFailure('session-refresh',refreshed.error?.code,undefined,ticket.trace);
    redirect('/profile/login?next=/profile/settings');
  }
  if(ticket.trace) telegramTrace(ticket.trace,'owner-session-refreshed');
  redirect('/profile/settings?telegram=linked');
}
