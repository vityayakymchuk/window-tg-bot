import { Telegraf, Markup } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);
const ENVIRONMENT = process.env.NODE_ENV || '';

if (!BOT_TOKEN) throw new Error('BOT_TOKEN не визначений у .env');
if (!ADMIN_CHAT_ID) throw new Error('ADMIN_CHAT_ID не визначений у .env');

interface UserState {
  step: number;
  answers: {
    q1?: string;
    q2?: string;
    q3?: string;
  };
  phoneRequested?: boolean;
  phoneNumber?: string;
}

const userStates: Record<number, UserState> = {};
const bot = new Telegraf(BOT_TOKEN);

// Стартове повідомлення
bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  userStates[chatId] = { step: 1, answers: {} };

  await ctx.reply(
    'Привіт! 👋\n\nЧи є у Вас проблеми з теплоізоляцією вікон (протяги, втрата тепла, погане відкривання)?',
    Markup.keyboard([['Так'], ['Ні']]).resize().oneTime()
  );
});

// Обробка контактів (номер телефону)
bot.on('contact', async (ctx) => {
  const chatId = ctx.chat.id;
  const state = userStates[chatId];
  if (state && ctx.message.contact) {
    state.phoneNumber = ctx.message.contact.phone_number;
    // Продовжуємо фінальний крок, якщо контакт надано після трьох питань
    const user = ctx.from;
    const report = `
📋 Новий запит від користувача:

1️⃣ Проблеми з теплоізоляцією: <b>${state.answers.q1}</b>
2️⃣ Конденсат / запотівання: <b>${state.answers.q2}</b>
3️⃣ Потрібна консультація: <b>${state.answers.q3}</b>
${state.phoneNumber ? `📞 Телефон: <b>${state.phoneNumber}</b>` : ''}
`;
    await ctx.telegram.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'HTML' });
    await ctx.reply(
      '🎁 При комплексних роботах ми даруємо вам безкоштовні ручки на конструкції — маленький бонус від нас для вашого комфорту ✨\n\n✅ Дякую за відповіді! Наш спеціаліст зв’яжеться з Вами 💬',
      Markup.keyboard([['🔁 Відповісти ще раз']]).resize()
    );
    delete userStates[chatId];
  }
});

// Основна логіка опитування
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;
  let state = userStates[chatId];

  if (text === '🔁 Відповісти ще раз') {
    userStates[chatId] = { step: 1, answers: {} };
    state = userStates[chatId];
    await ctx.reply(
      'Почнемо спочатку 😊\n\nЧи є у Вас проблеми з теплоізоляцією вікон?',
      Markup.keyboard([['Так'], ['Ні']]).resize().oneTime()
    );
    return;
  }

  if (!state) return;

  switch (state.step) {
    case 1:
      state.answers.q1 = text;
      state.step = 2;
      await ctx.reply(
        'Чи помічали Ви конденсат або запотівання на вікнах?',
        Markup.keyboard([['Так'], ['Ні']]).resize().oneTime()
      );
      break;

    case 2:
      state.answers.q2 = text;
      state.step = 3;
      await ctx.reply(
        'Чи плануєте Ви заміну вікон найближчим часом, і чи потрібна Вам консультація спеціаліста?',
        Markup.keyboard([['Так'], ['Ні']]).resize().oneTime()
      );
      break;

    case 3:
      state.answers.q3 = text;

      const user = ctx.from;
      const usernameLink = user?.username ? `https://t.me/${user.username}` : '';

      // Якщо username немає, запитуємо номер телефону
      if (!user?.username && !state.phoneRequested) {
        state.phoneRequested = true;
        await ctx.reply(
          'У Вас немає username в Telegram. Будь ласка, надішліть свій номер телефону для зворотного зв’язку.',
          Markup.keyboard([
            Markup.button.contactRequest('Надати номер телефону')
          ]).resize().oneTime()
        );
        return;
      }

      const report = `
📋 Новий запит від користувача:

1️⃣ Проблеми з теплоізоляцією: <b>${state.answers.q1}</b>
2️⃣ Конденсат / запотівання: <b>${state.answers.q2}</b>
3️⃣ Потрібна консультація: <b>${state.answers.q3}</b>
${usernameLink ? `💬 <a href="${usernameLink}">Написати користувачу</a>` : ''}
${state.phoneNumber ? `📞 Телефон: <b>${state.phoneNumber}</b>` : ''}
`;

      await ctx.telegram.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'HTML' });
      await ctx.reply(
        '🎁 При комплексних роботах ми даруємо вам безкоштовні ручки на конструкції — маленький бонус від нас для вашого комфорту ✨\n\n✅ Дякую за відповіді! Наш спеціаліст зв’яжеться з Вами 💬',
        Markup.keyboard([['🔁 Відповісти ще раз']]).resize()
      );

      delete userStates[chatId];
      break;
  }
});

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};
//dev mode
ENVIRONMENT !== 'production' && development(bot);