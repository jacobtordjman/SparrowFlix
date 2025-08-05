// functions/api/stream.js

async function getTelegramFileUrl(env, botToken, fileId) {
  try {
    const cached = await env.FILEPATH_CACHE.get(fileId);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() < data.expiresAt) {
        return data.url;
      }
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const data = await response.json();

    if (!data.ok || !data.result) {
      throw new Error('Failed to get file info');
    }

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;

    await env.FILEPATH_CACHE.put(
      fileId,
      JSON.stringify({ url: fileUrl, expiresAt: Date.now() + 60 * 60 * 1000 }),
      { expirationTtl: 3600 }
    );

    return fileUrl;
  } catch (error) {
    console.error('Error getting Telegram file URL:', error);
    return null;
  }
}

import { D1Database } from '../db/d1-connection.js';
import { SecureTicketSystem } from './secure-tickets.js';
import { RateLimiter } from '../utils/rate-limiter.js';

export async function handleStreamRequest(request, env) {
  const url = new URL(request.url);
  const ticketId = url.pathname.split('/').pop();
  const hmacToken = url.searchParams.get('token');

  if (!ticketId) {
    return new Response('Ticket ID required', { status: 400 });
  }

  if (!hmacToken) {
    return new Response('Security token required', { status: 400 });
  }

  // Initialize security systems
  const db = new D1Database(env.DB);
  const ticketSystem = new SecureTicketSystem(db, env.JWT_SECRET || 'fallback-secret');
  const rateLimiter = new RateLimiter(db);
  
  // Extract client IP
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   '127.0.0.1';

  // Check IP blacklist
  const blacklistCheck = await rateLimiter.isBlacklisted(clientIP);
  if (blacklistCheck.blacklisted) {
    return new Response(`Access denied: ${blacklistCheck.reason}`, { status: 403 });
  }

  // Check streaming rate limits
  const rateLimitResult = await rateLimiter.checkRateLimit(request, 'stream_access');
  if (!rateLimitResult.allowed) {
    return new Response(`Rate limit exceeded: ${rateLimitResult.reason}`, { 
      status: 429,
      headers: rateLimitResult.headers
    });
  }

  // Verify and consume ticket
  const verification = await ticketSystem.verifyAndConsumeTicket(ticketId, hmacToken, clientIP);
  
  if (!verification.valid) {
    console.log('Ticket verification failed:', verification.error);
    return new Response(`Access denied: ${verification.error}`, { status: 403 });
  }

  const fileId = verification.fileId;
  
  if (!fileId) {
    return new Response('File not available', { status: 404 });
  }

  const fileUrl = await getTelegramFileUrl(env, env.BOT_TOKEN, fileId);
  if (!fileUrl) {
    return new Response('Not found', { status: 404 });
  }

  const tgResponse = await fetch(fileUrl);
  if (!tgResponse.ok || !tgResponse.body) {
    return new Response('Failed to fetch file', { status: tgResponse.status });
  }

  return new Response(tgResponse.body, {
    status: 200,
    headers: {
      'Content-Type': tgResponse.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': tgResponse.headers.get('Content-Length') || undefined,
      'Cache-Control': 'public, max-age=86400'
    }
  });
}
