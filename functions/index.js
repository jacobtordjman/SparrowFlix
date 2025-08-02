// functions/index.js
import { handleTelegramWebhook } from './telegram/webhook.js';
import { handleApiRequest } from './api/index.js';
import { handleStreamRequest } from './api/stream.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for API
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Telegram webhook
      if (path === '/webhook' && request.method === 'POST') {
        return await handleTelegramWebhook(request, env);
      }

      // API routes
      if (path.startsWith('/api/')) {
        const response = await handleApiRequest(request, env, path);
        return new Response(response.body, {
          status: response.status,
          headers: { ...corsHeaders, ...response.headers },
        });
      }

      // Stream endpoint
      if (path.startsWith('/stream/')) {
        return await handleStreamRequest(request, env);
      }

      // Health check
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Serve static files from /web for all other routes
      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};