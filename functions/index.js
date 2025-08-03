// functions/index.js - Enhanced with better error handling
import { handleTelegramWebhook } from './telegram/webhook.js';
import { handleApiRequest } from './api/index.js';
import { handleStreamRequest } from './api/stream.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log(`Request: ${request.method} ${path}`);

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
      // Health check
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          environment: {
            hasMongoAppId: !!env.MONGODB_APP_ID,
            hasMongoApiKey: !!env.MONGODB_API_KEY,
            hasDataSource: !!env.MONGODB_DATA_SOURCE,
            hasDatabase: !!env.MONGODB_DATABASE,
            hasBotToken: !!env.BOT_TOKEN,
            hasStorageChannel: !!env.STORAGE_CHANNEL_ID
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Debug endpoint for development
      if (path === '/debug/env' && env.DEV_NO_AUTH) {
        return new Response(JSON.stringify({
          mongodb_app_id: env.MONGODB_APP_ID || 'missing',
          mongodb_data_source: env.MONGODB_DATA_SOURCE || 'missing',
          mongodb_database: env.MONGODB_DATABASE || 'missing',
          has_api_key: !!env.MONGODB_API_KEY,
          has_bot_token: !!env.BOT_TOKEN,
          has_storage_channel: !!env.STORAGE_CHANNEL_ID
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // MongoDB debug endpoint
      if (path === '/debug/mongodb' && env.DEV_NO_AUTH) {
        try {
          const testUrl = `https://data.mongodb-api.com/app/${env.MONGODB_APP_ID}/endpoint/data/v1/action/find`;
          const testPayload = {
            collection: 'movies',
            database: env.MONGODB_DATABASE,
            dataSource: env.MONGODB_DATA_SOURCE,
            filter: {},
            limit: 1
          };

          console.log('Testing MongoDB connection...');
          console.log('URL:', testUrl);
          console.log('Payload:', JSON.stringify(testPayload, null, 2));

          const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': env.MONGODB_API_KEY
            },
            body: JSON.stringify(testPayload)
          });

          const responseText = await response.text();
          
          return new Response(JSON.stringify({
            mongodb_test: {
              url: testUrl,
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries()),
              response: responseText,
              config: {
                app_id: env.MONGODB_APP_ID,
                data_source: env.MONGODB_DATA_SOURCE,
                database: env.MONGODB_DATABASE,
                api_key_length: env.MONGODB_API_KEY?.length || 0
              }
            }
          }, null, 2), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        } catch (error) {
          return new Response(JSON.stringify({
            mongodb_test_error: {
              message: error.message,
              stack: error.stack,
              config: {
                app_id: env.MONGODB_APP_ID,
                data_source: env.MONGODB_DATA_SOURCE,
                database: env.MONGODB_DATABASE
              }
            }
          }, null, 2), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }
      }

      // Simple test endpoint
      if (path === '/test') {
        return new Response(JSON.stringify({
          message: 'SparrowFlix worker is running!',
          timestamp: new Date().toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Telegram webhook
      if (path === '/webhook' && request.method === 'POST') {
        console.log('Webhook request received');
        try {
          const result = await handleTelegramWebhook(request, env);
          return new Response(result.body || 'OK', {
            status: result.status || 200,
            headers: corsHeaders,
          });
        } catch (webhookError) {
          console.error('Webhook Error:', webhookError);
          return new Response(JSON.stringify({
            error: 'Webhook failed',
            message: webhookError.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }
      }

      // API routes
      if (path.startsWith('/api/')) {
        console.log('API request received:', path);
        try {
          const response = await handleApiRequest(request, env, path);
          return new Response(response.body, {
            status: response.status,
            headers: { ...corsHeaders, ...response.headers },
          });
        } catch (apiError) {
          console.error('API Error:', apiError);
          return new Response(JSON.stringify({
            error: 'API request failed',
            message: apiError.message,
            stack: apiError.stack
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }
      }

      // Stream endpoint
      if (path.startsWith('/stream/')) {
        console.log('Stream request received:', path);
        return await handleStreamRequest(request, env);
      }

      // Default response for unknown paths
      return new Response(JSON.stringify({
        error: 'Not found',
        path: path,
        available_endpoints: [
          '/health',
          '/test',
          '/api/content',
          '/webhook',
          '/stream/{file_id}'
        ]
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
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