// functions/api/ticket.js - Updated with Secure Ticket System (Phase 2.1)
import { D1Database } from '../db/d1-connection.js';
import { SecureTicketSystem } from './secure-tickets.js';

// Legacy function - deprecated
export function generateTicketId() {
  console.warn('generateTicketId is deprecated - use SecureTicketSystem instead');
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Legacy function - deprecated  
export async function createTicket(env, data, dbOverride = null) {
  console.warn('createTicket is deprecated - use SecureTicketSystem.createTicket instead');
  
  // Fallback to new secure system
  const db = new D1Database(env.DB);
  const ticketSystem = new SecureTicketSystem(db, env.JWT_SECRET || 'fallback-secret');
  
  // Extract client IP (simplified for legacy compatibility)
  const clientIP = '127.0.0.1'; // In real usage, extract from request
  
  try {
    return await ticketSystem.createTicket(data, clientIP);
  } catch (error) {
    throw new Error(`Ticket creation failed: ${error.message}`);
  }
}

export async function handleTicketApi(request, env, params, user) {
  const [action] = params;
  const db = new D1Database(env.DB);
  const ticketSystem = new SecureTicketSystem(db, env.JWT_SECRET || 'fallback-secret');
  
  // Extract client information for security
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   '127.0.0.1';
  const userAgent = request.headers.get('User-Agent') || '';

  switch (action) {
    case 'create':
      return await handleTicketCreate(request, ticketSystem, user, clientIP, userAgent);
    case 'revoke':
      return await handleTicketRevoke(request, ticketSystem, user, params);
    case 'analytics':
      return await handleTicketAnalytics(request, ticketSystem, user);
    default:
      return {
        body: JSON.stringify({ error: 'Invalid ticket action' }),
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      };
  }
}

async function handleTicketCreate(request, ticketSystem, user, clientIP, userAgent) {
  if (request.method !== 'POST') {
    return {
      body: JSON.stringify({ error: 'Method not allowed' }),
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (!user) {
    return {
      body: JSON.stringify({ error: 'Authentication required' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    const { contentId, type, season, episode, expiresAt } = await request.json();

    if (!contentId || !type) {
      return {
        body: JSON.stringify({ error: 'Missing required fields' }),
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const ticket = await ticketSystem.createTicket({
      contentId,
      type,
      season,
      episode,
      userId: user.id,
      expiresAt
    }, clientIP, userAgent);

    // Log security event
    await logSecurityEvent(ticketSystem.db, {
      eventType: 'ticket_create',
      userId: user.id,
      clientIP,
      userAgent,
      details: JSON.stringify({ contentId, type, ticketId: ticket.ticketId }),
      severity: 'info'
    });

    return {
      body: JSON.stringify({
        ticket: ticket.ticketId,
        hmacToken: ticket.hmacToken,
        expiresAt: ticket.expiresAt,
        streamUrl: ticket.streamUrl,
        maxUses: ticket.maxUses
      }),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Ticket creation error:', error);
    
    // Log security event for failed attempts
    await logSecurityEvent(ticketSystem.db, {
      eventType: 'ticket_create_failed',
      userId: user?.id,
      clientIP,
      userAgent,
      details: JSON.stringify({ error: error.message }),
      severity: 'medium'
    });

    return {
      body: JSON.stringify({ error: 'Failed to create ticket' }),
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

async function handleTicketRevoke(request, ticketSystem, user, params) {
  if (request.method !== 'POST') {
    return {
      body: JSON.stringify({ error: 'Method not allowed' }),
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (!user) {
    return {
      body: JSON.stringify({ error: 'Authentication required' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    const [, ticketId] = params;
    const { reason } = await request.json();

    if (!ticketId) {
      return {
        body: JSON.stringify({ error: 'Ticket ID required' }),
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const revoked = await ticketSystem.revokeTicket(ticketId, reason || 'User requested');

    return {
      body: JSON.stringify({ 
        success: revoked,
        message: revoked ? 'Ticket revoked' : 'Ticket not found'
      }),
      status: revoked ? 200 : 404,
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Ticket revocation error:', error);
    return {
      body: JSON.stringify({ error: 'Failed to revoke ticket' }),
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

async function handleTicketAnalytics(request, ticketSystem, user) {
  if (request.method !== 'GET') {
    return {
      body: JSON.stringify({ error: 'Method not allowed' }),
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  // Only allow authenticated users to view analytics
  if (!user) {
    return {
      body: JSON.stringify({ error: 'Authentication required' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    const analytics = await ticketSystem.getTicketAnalytics();
    
    return {
      body: JSON.stringify({
        analytics,
        timestamp: Date.now()
      }),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return {
      body: JSON.stringify({ error: 'Failed to fetch analytics' }),
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

// Security event logging
async function logSecurityEvent(db, event) {
  try {
    await db.db.prepare(`
      INSERT INTO security_events (event_type, user_id, client_ip, user_agent, details, severity, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.eventType,
      event.userId || null,
      event.clientIP,
      event.userAgent,
      event.details,
      event.severity,
      Date.now()
    ).run();
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}
