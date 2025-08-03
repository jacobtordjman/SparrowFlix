// functions/telegram/webhook.js - Enhanced version
import { Bot } from './bot.js';
import { connectDB } from '../db/connection.js';

export async function handleTelegramWebhook(request, env) {
  try {
    console.log('Webhook received at:', new Date().toISOString());
    
    // More flexible secret verification
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) {
      console.log('Invalid webhook secret:', secret);
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await request.json();
    console.log('Update received:', JSON.stringify(update, null, 2));
    
    // Initialize bot with environment
    const bot = new Bot(env.BOT_TOKEN, env);
    
    try {
      // Connect to database with timeout
      const db = await Promise.race([
        connectDB(env),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DB connection timeout')), 5000)
        )
      ]);
      bot.setDB(db);
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      // Still try to respond to user
      await bot.sendMessage(
        update.message?.chat?.id || update.callback_query?.from?.id,
        '⚠️ Service temporarily unavailable. Please try again in a moment.'
      );
      return new Response('DB Error', { status: 500 });
    }

    // Process the update
    await bot.handleUpdate(update);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Always return 200 to stop Telegram retries for invalid updates
    return new Response('Error logged', { status: 200 });
  }
}

// Add this debugging endpoint to your main functions/index.js
export function addWebhookDebugEndpoint(routes) {
  // Add to your router
  if (path === '/debug/webhook' && request.method === 'GET') {
    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: {
        hasWebhookSecret: !!env.WEBHOOK_SECRET,
        hasMongoUri: !!env.MONGO_URI,
        hasBotToken: !!env.BOT_TOKEN
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}