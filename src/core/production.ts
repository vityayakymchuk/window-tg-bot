import { VercelRequest, VercelResponse } from '@vercel/node';

import createDebug from 'debug';

import { Context, Telegraf } from 'telegraf';

import { Update } from 'telegraf/typings/core/types/typegram';

const debug = createDebug('bot:dev');

const PORT = (process.env.PORT && parseInt(process.env.PORT, 10)) || 3000;

const WEBHOOK_URL = 'https://window-tg-bot.vercel.app/api';

const production = async (

  req: VercelRequest,

  res: VercelResponse,

  bot: Telegraf<Context<Update>>,

) => {

  debug('Bot runs in production mode');

  debug(`setting webhook: ${WEBHOOK_URL}`);

  const getWebhookInfo = await bot.telegram.getWebhookInfo();

  if (getWebhookInfo.url !== WEBHOOK_URL) {

    debug(`deleting webhook ${getWebhookInfo.url}`);

    await bot.telegram.deleteWebhook();

    debug(`setting webhook: ${WEBHOOK_URL}`);

    await bot.telegram.setWebhook(WEBHOOK_URL);

  }

  if (req.method === 'POST') {

    await bot.handleUpdate(req.body as unknown as Update, res);

  } else {

    res.status(200).json('Listening to bot events...');

  }

  debug(`starting webhook on port: ${PORT}`);

};

export { production };