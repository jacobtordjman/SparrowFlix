// functions/api/secure-tickets.js - Secure Ticket System (Phase 2.1)
// Replaces predictable hex-based tickets with cryptographically secure system

import crypto from 'crypto';

export class SecureTicketSystem {
  constructor(db, secretKey) {
    this.db = db;
    this.secretKey = secretKey;
    
    // Ticket configuration
    this.DEFAULT_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours
    this.MAX_USES = 3; // Prevent excessive sharing
  }

  // Generate cryptographically secure UUID v4
  generateSecureUUID() {
    const bytes = crypto.randomBytes(16);
    
    // Set version (4) and variant bits according to RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant bits
    
    return [
      bytes.subarray(0, 4).toString('hex'),
      bytes.subarray(4, 6).toString('hex'),
      bytes.subarray(6, 8).toString('hex'),
      bytes.subarray(8, 10).toString('hex'),
      bytes.subarray(10, 16).toString('hex')
    ].join('-');
  }

  // Generate time-based HMAC token
  generateHMACToken(ticketId, expiresAt, clientIP, userId) {
    const data = `${ticketId}|${expiresAt}|${clientIP}|${userId}`;
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(data)
      .digest('hex');
  }

  // Verify HMAC token
  verifyHMACToken(ticketId, expiresAt, clientIP, userId, providedToken) {
    const expectedToken = this.generateHMACToken(ticketId, expiresAt, clientIP, userId);
    return crypto.timingSafeEqual(
      Buffer.from(expectedToken, 'hex'),
      Buffer.from(providedToken, 'hex')
    );
  }

  // Create secure streaming ticket
  async createTicket(data, clientIP, userAgent = '') {
    const ticketId = this.generateSecureUUID();
    const now = Date.now();
    const expiresAt = data.expiresAt || (now + this.DEFAULT_EXPIRY);
    
    // Get file_id based on content type
    let fileId = null;
    if (data.type === 'movie') {
      const movie = await this.db.getMovieById(data.contentId);
      fileId = movie?.file_id;
    } else if (data.type === 'show') {
      const episodes = await this.db.getEpisodesByShow(data.contentId, data.season);
      const episode = episodes.find(ep => ep.episode_number === data.episode);
      fileId = episode?.file_id;
    }

    if (!fileId) {
      throw new Error('Content not found or no file available');
    }

    // Generate HMAC token for additional security
    const hmacToken = this.generateHMACToken(ticketId, expiresAt, clientIP, data.userId);

    // Store ticket in D1 with revocation capability
    const ticketData = {
      id: ticketId,
      user_id: data.userId,
      content_id: data.contentId,
      content_type: data.type,
      season_number: data.season || null,
      episode_number: data.episode || null,
      file_id: fileId,
      hmac_token: hmacToken,
      client_ip: clientIP,
      user_agent: userAgent,
      created_at: now,
      expires_at: expiresAt,
      use_count: 0,
      max_uses: this.MAX_USES,
      is_revoked: 0
    };

    await this.db.db.prepare(`
      INSERT INTO streaming_tickets (
        id, user_id, content_id, content_type, season_number, episode_number,
        file_id, hmac_token, client_ip, user_agent, created_at, expires_at,
        use_count, max_uses, is_revoked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      ticketId, data.userId, data.contentId, data.type, data.season || null,
      data.episode || null, fileId, hmacToken, clientIP, userAgent,
      now, expiresAt, 0, this.MAX_USES, 0
    ).run();

    return {
      ticketId,
      hmacToken,
      expiresAt,
      streamUrl: `/stream/${ticketId}?token=${hmacToken}`,
      maxUses: this.MAX_USES
    };
  }

  // Verify and consume ticket
  async verifyAndConsumeTicket(ticketId, hmacToken, clientIP) {
    const now = Date.now();
    
    // Get ticket from D1
    const ticket = await this.db.db.prepare(`
      SELECT * FROM streaming_tickets 
      WHERE id = ? AND is_revoked = 0
    `).bind(ticketId).first();

    if (!ticket) {
      return { valid: false, error: 'Ticket not found or revoked' };
    }

    // Check expiration
    if (ticket.expires_at < now) {
      return { valid: false, error: 'Ticket expired' };
    }

    // Check usage limit
    if (ticket.use_count >= ticket.max_uses) {
      return { valid: false, error: 'Ticket usage limit exceeded' };
    }

    // Verify HMAC token
    if (!this.verifyHMACToken(
      ticketId, 
      ticket.expires_at, 
      ticket.client_ip, 
      ticket.user_id, 
      hmacToken
    )) {
      return { valid: false, error: 'Invalid token signature' };
    }

    // IP-based check (optional - can be configured)
    const allowIPChange = true; // Could be configurable
    if (!allowIPChange && ticket.client_ip !== clientIP) {
      return { valid: false, error: 'IP address mismatch' };
    }

    // Increment use count
    await this.db.db.prepare(`
      UPDATE streaming_tickets 
      SET use_count = use_count + 1, last_used_at = ? 
      WHERE id = ?
    `).bind(now, ticketId).run();

    return {
      valid: true,
      fileId: ticket.file_id,
      contentType: ticket.content_type,
      remainingUses: ticket.max_uses - (ticket.use_count + 1)
    };
  }

  // Revoke ticket (for security incidents)
  async revokeTicket(ticketId, reason = 'Manual revocation') {
    const now = Date.now();
    
    const result = await this.db.db.prepare(`
      UPDATE streaming_tickets 
      SET is_revoked = 1, revoked_at = ?, revocation_reason = ?
      WHERE id = ?
    `).bind(now, reason, ticketId).run();

    return result.changes > 0;
  }

  // Revoke all user tickets (for compromised accounts)
  async revokeAllUserTickets(userId, reason = 'Account security') {
    const now = Date.now();
    
    const result = await this.db.db.prepare(`
      UPDATE streaming_tickets 
      SET is_revoked = 1, revoked_at = ?, revocation_reason = ?
      WHERE user_id = ? AND is_revoked = 0
    `).bind(now, reason, userId).run();

    return result.changes;
  }

  // Clean up expired tickets (run periodically)
  async cleanupExpiredTickets() {
    const now = Date.now();
    
    const result = await this.db.db.prepare(`
      DELETE FROM streaming_tickets 
      WHERE expires_at < ? OR (is_revoked = 1 AND revoked_at < ?)
    `).bind(now, now - (7 * 24 * 60 * 60 * 1000)).run(); // Keep revoked tickets for 7 days for audit

    return result.changes;
  }

  // Get ticket usage analytics
  async getTicketAnalytics(timeframe = 24 * 60 * 60 * 1000) {
    const since = Date.now() - timeframe;
    
    const stats = await this.db.db.prepare(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN is_revoked = 1 THEN 1 END) as revoked_tickets,
        COUNT(CASE WHEN expires_at < ? THEN 1 END) as expired_tickets,
        AVG(use_count) as avg_usage,
        MAX(use_count) as max_usage
      FROM streaming_tickets 
      WHERE created_at > ?
    `).bind(Date.now(), since).first();

    return stats;
  }

  // Audit trail for security monitoring
  async getSecurityEvents(limit = 100) {
    return await this.db.db.prepare(`
      SELECT id, user_id, client_ip, created_at, expires_at, use_count, 
             is_revoked, revoked_at, revocation_reason
      FROM streaming_tickets 
      WHERE is_revoked = 1 OR use_count >= max_uses
      ORDER BY created_at DESC 
      LIMIT ?
    `).bind(limit).all();
  }
}