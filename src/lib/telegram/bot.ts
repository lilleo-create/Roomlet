import { timingSafeEqual } from 'node:crypto';

type Button = {text:string;url?:string;web_app?:{url:string}};
const destinations: Record<string, [string,string]> = {
  shop:['Смотреть коллекцию','/catalog'], custom:['Создать на заказ','/custom'],
  orders:['Мои заказы','/profile/orders'], favorites:['Избранное','/favorites'], settings:['Настройки','/profile/settings'],
};
export function parseCommand(value: unknown): {updateId:number;chatId:number;command:string} | null {
  if (!value || typeof value !== 'object') return null;
  const {update_id,message} = value as {update_id?:number;message?:{text?:string;from?:{id?:number;is_bot?:boolean};chat?:{id?:number;type?:string}}};
  if (!Number.isSafeInteger(update_id) || update_id! < 0 || message?.chat?.type !== 'private' ||
      !Number.isSafeInteger(message.chat.id) || message.chat.id! <= 0 || message.from?.is_bot !== false ||
      message.from.id !== message.chat.id || typeof message.text !== 'string') return null;
  const match = /^\/([a-z]+)(?:@([a-z0-9_]+))?(?:\s|$)/i.exec(message.text);
  if (!match || match[2] && match[2].toLowerCase() !== 'roomlet_shop_bot') return null;
  return {updateId:update_id!,chatId:message.chat.id!,command:match[1].toLowerCase()};
}
export function botReply(command: string, origin: string, support?: string): {text:string;image?:string;buttons:Button[][]} {
  const button = (key:string): Button => ({text:destinations[key][0],web_app:{url:origin+'/mini?next='+encodeURIComponent(destinations[key][1])}});
  if (command === 'start') return {text:'roomlet.\nКоллекционные миниатюры ручной работы.\n\nВыберите готовую работу или создадим вашу историю.',image:origin+'/images/telegram-welcome.png',buttons:[[button('shop')],[button('custom'),button('orders')]]};
  if (command === 'support') {
    const username = support?.trim().replace(/^@/,'');
    return username && /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)
      ? {text:'Связаться с мастерской',buttons:[[{text:'Написать мастеру',url:'https://t.me/'+username}]]}
      : {text:'Связь с мастерской пока недоступна.',buttons:[]};
  }
  if (destinations[command]) return {text:destinations[command][0],buttons:[[button(command)]]};
  return {text:'Откройте коллекцию или выберите команду в меню.',buttons:[[button('shop')]]};
}
export function validWebhookSecret(actual: string | null, expected?: string) {
  if (!expected || !/^[A-Za-z0-9_-]{32,256}$/.test(expected) || !actual) return false;
  const a=Buffer.from(actual),b=Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
