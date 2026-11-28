"use server";
import { redirect } from 'next/navigation';
import { createRoomletClient } from '@/lib/supabase/server';
import { recentlyAuthenticated } from '@/lib/telegram/assertion.server';
import { readLinkTicket, clearLinkTicket } from '@/lib/telegram/link-ticket.server';
import { telegramAdmin } from '@/lib/telegram/http.server';
import { telegramFailure } from '@/lib/telegram/diagnostics.server';

export async function confirmTelegramTransfer(_state: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const client = await createRoomletClient();
  const { data: { user } } = await client.auth.getUser();
  const { data } = await client.auth.getClaims();
  if (!user?.email_confirmed_at || !user.email || data?.claims.sub !== user.id || !recentlyAuthenticated(data.claims.amr))
    redirect('/profile/login?next=/profile/telegram');
  if (form.get('allow_transfer') !== 'yes') return { error: 'Подтвердите объединение аккаунтов.' };
  const ticket = await readLinkTicket(user.id);
  if (!ticket) return { error: 'Время подтверждения истекло. Подключите Telegram ещё раз.' };
  const result = await telegramAdmin().rpc('roomlet_transfer_telegram', { p_target: user.id, p_telegram_id: ticket.telegramId, p_proof_hash: ticket.proof });
  if (result.error || result.data !== true) {
    const reference = telegramFailure('confirmed-transfer', result.error?.code);
    return { error: `Не удалось объединить аккаунты. Данные сохранены. Код обращения: ${reference}.` };
  }
  await clearLinkTicket();
  await client.auth.refreshSession();
  redirect('/profile/settings?telegram=linked');
}
