// functions/telegram/webhook.js
import { Bot } from './bot.js';
import { connectDB } from '../db/connection.js';

export async function handleTelegramWebhook(request, env) {
  try {
    // Log for debugging
    console.log('Webhook received');
    
    // Verify webhook secret
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== env.WEBHOOK_SECRET) {
      console.log('Invalid webhook secret');
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await request.json();
    console.log('Update:', JSON.stringify(update));
    
    // Initialize bot with environment
    const bot = new Bot(env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN, env);
    
    // Connect to database
    const db = await connectDB(env);
    bot.setDB(db);

    // Process the update
    await bot.handleUpdate(update);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error processing update', { status: 500 });
  }
}