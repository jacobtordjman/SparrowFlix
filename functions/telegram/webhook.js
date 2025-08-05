// functions/telegram/webhook.js - Secure Webhook Handler (Phase 5.2)
import { handleSecureWebhook } from './webhook-security.js';

/**
 * Main webhook handler with security and validation
 * Routes to the secure webhook system with proper HMAC validation,
 * request queuing, and idempotency checks
 */
export async function handleTelegramWebhook(request, env) {
  return await handleSecureWebhook(request, env);
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