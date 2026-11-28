import test from 'node:test';
import assert from 'node:assert/strict';
import { botReply, parseCommand, validWebhookSecret } from '../src/lib/telegram/bot.ts';

test('only private human commands addressed to this bot are handled', () => {
  const update = {update_id:4,message:{chat:{id:42,type:'private'},from:{id:42,is_bot:false},text:'/shop@roomlet_shop_bot'}};
  assert.deepEqual(parseCommand(update), {updateId:4,chatId:42,command:'shop'});
  assert.equal(parseCommand({...update,message:{...update.message,text:'/shop@another_bot'}}), null);
  assert.equal(parseCommand({...update,message:{...update.message,chat:{id:42,type:'group'}}}), null);
  assert.equal(parseCommand({...update,update_id:-1}), null);
});
test('all seven commands use real Mini App routes and support is configurable', () => {
  const origin='https://roomlet.example';
  const routes={shop:'/catalog',custom:'/custom',orders:'/profile/orders',favorites:'/favorites',settings:'/profile/settings'};
  for(const [command,route] of Object.entries(routes)) {
    const reply=botReply(command,origin,'Aksinia_atoM');
    assert.equal(new URL(reply.buttons[0][0].web_app!.url).searchParams.get('next'),route);
  }
  assert.equal(botReply('start',origin).image,origin+'/images/telegram-welcome.png');
  assert.equal(botReply('start',origin).buttons.flat().length,3);
  assert.match(botReply('support',origin).text,/пока недоступна/);
  assert.equal(botReply('support',origin,'@Aksinia_atoM').buttons[0][0].url,'https://t.me/Aksinia_atoM');
  assert.equal(botReply('support',origin,'bad/name').buttons.length,0);
});
test('webhook requires an exact strong secret', () => {
  const secret='a'.repeat(40);
  assert.equal(validWebhookSecret(secret,secret),true);
  assert.equal(validWebhookSecret(secret,'b'.repeat(40)),false);
  assert.equal(validWebhookSecret(null,secret),false);
  assert.equal(validWebhookSecret('short','short'),false);
});
