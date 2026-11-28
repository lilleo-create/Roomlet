import { botReply, parseCommand, validWebhookSecret } from '@/lib/telegram/bot';
import { boundedText, telegramAdmin } from '@/lib/telegram/http.server';
import { issuerOrigin } from '@/lib/telegram/assertion.server';
import { readSupportUsername } from '@/lib/telegram/support.server';

export const runtime='nodejs';
const ack=()=>new Response(null,{status:200});
export async function POST(request:Request) {
  if (!validWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'),process.env.TELEGRAM_WEBHOOK_SECRET))
    return new Response(null,{status:403});
  let update;
  try {update=parseCommand(JSON.parse(await boundedText(request,65536)));}
  catch {return new Response(null,{status:400});}
  if (!update) return ack();
  try {
    const token=process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return new Response(null,{status:503});
    const support=update.command==='support'?await readSupportUsername():null;
    const message=botReply(update.command,issuerOrigin(process.env.ROOMLET_SITE_URL),support??undefined);
    const admin=telegramAdmin();
    // Commit the claim before sending: a lost Bot API response must not send twice.
    const claim=await admin.rpc('claim_telegram_update',{event_id:update.updateId});
    if(claim.error) return new Response(null,{status:503});
    if(claim.data!==true) return ack();
    let status='uncertain';
    try {
      const response=await fetch(`https://api.telegram.org/bot${token}/${message.image?'sendPhoto':'sendMessage'}`,{
        method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
        body:JSON.stringify({chat_id:update.chatId, ...(message.image?{photo:message.image,caption:message.text}:{text:message.text}),
          reply_markup:{inline_keyboard:message.buttons}}),cache:'no-store',
      });
      const result=await response.json();
      status=response.ok && result.ok===true?'sent':'failed';
    } catch { /* Timeout is ambiguous: record it, never automatically send twice. */ }
    await admin.rpc('finish_telegram_update',{event_id:update.updateId,outcome:status});
    if(status!=='sent') console.warn('Telegram command reply not confirmed',{updateId:update.updateId,status});
    return ack();
  } catch {return new Response(null,{status:503});}
}
