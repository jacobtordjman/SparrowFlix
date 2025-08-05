// functions/utils/rate-limiter.js - Self-hosted Rate Limiting System (Phase 2.2)
// Implements sliding-window and token-bucket algorithms with D1 storage

export class RateLimiter {
  constructor(db) {
    this.db = db;
    
    // Default rate limits
    this.limits = {
      // General API limits
      'api_general': { requests: 100, window: 60 * 1000, burst: 10 }, // 100/min, burst 10
      'api_content': { requests: 50, window: 60 * 1000, burst: 5 },   // 50/min, burst 5
      'api_search': { requests: 20, window: 60 * 1000, burst: 3 },    // 20/min, burst 3
      'api_ticket': { requests: 10, window: 60 * 1000, burst: 2 },    // 10/min, burst 2
      'api_auth': { requests: 5, window: 60 * 1000, burst: 1 },       // 5/min, burst 1
      'api_upload': { requests: 3, window: 60 * 1000, burst: 1 },     // 3/min, burst 1
      
      // Per-IP limits (stricter)
      'ip_global': { requests: 200, window: 60 * 1000, burst: 20 },   // 200/min per IP
      'ip_auth': { requests: 10, window: 60 * 1000, burst: 3 },       // 10/min auth attempts per IP
      
      // Streaming limits
      'stream_access': { requests: 30, window: 60 * 1000, burst: 5 }, // 30 streams/min
      'stream_ticket': { requests: 15, window: 60 * 1000, burst: 3 }  // 15 tickets/min
    };
  }

  // Sliding window rate limiter
  async checkSlidingWindow(key, limitType, identifier) {
    const limit = this.limits[limitType];
    if (!limit) {
      throw new Error(`Unknown limit type: ${limitType}`);
    }

    const now = Date.now();
    const windowStart = now - limit.window;
    const rateLimitKey = `${limitType}:${key}`;

    try {
      // Clean old entries and count recent requests
      await this.db.db.prepare(`
        DELETE FROM rate_limit_log 
        WHERE limit_key = ? AND timestamp < ?
      `).bind(rateLimitKey, windowStart).run();

      const result = await this.db.db.prepare(`
        SELECT COUNT(*) as count FROM rate_limit_log 
        WHERE limit_key = ? AND timestamp >= ?
      `).bind(rateLimitKey, windowStart).first();

      const currentCount = result?.count || 0;

      // Check if limit exceeded
      if (currentCount >= limit.requests) {
        // Log abuse attempt
        await this.logSecurityEvent({
          eventType: 'rate_limit_exceeded',
          limitKey: rateLimitKey,
          currentCount,
          limit: limit.requests,
          identifier,
          severity: 'medium'
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime: windowStart + limit.window,
          retryAfter: Math.ceil((windowStart + limit.window - now) / 1000)
        };
      }

      // Log this request
      await this.db.db.prepare(`
        INSERT INTO rate_limit_log (limit_key, identifier, timestamp)
        VALUES (?, ?, ?)
      `).bind(rateLimitKey, identifier, now).run();

      return {
        allowed: true,
        remaining: limit.requests - currentCount - 1,
        resetTime: windowStart + limit.window,
        retryAfter: 0
      };

    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request but log error
      return { allowed: true, remaining: 0, resetTime: now + limit.window, retryAfter: 0 };
    }
  }

  // Token bucket rate limiter (for burst handling)
  async checkTokenBucket(key, limitType, identifier) {
    const limit = this.limits[limitType];
    if (!limit) {
      throw new Error(`Unknown limit type: ${limitType}`);
    }

    const now = Date.now();
    const bucketKey = `bucket:${limitType}:${key}`;

    try {
      // Get or create bucket
      let bucket = await this.db.db.prepare(`
        SELECT tokens, last_refill FROM token_buckets 
        WHERE bucket_key = ?
      `).bind(bucketKey).first();

      if (!bucket) {
        // Create new bucket
        bucket = {
          tokens: limit.burst,
          last_refill: now
        };
        
        await this.db.db.prepare(`
          INSERT INTO token_buckets (bucket_key, tokens, last_refill, max_tokens, refill_rate)
          VALUES (?, ?, ?, ?, ?)
        `).bind(bucketKey, bucket.tokens, bucket.last_refill, limit.burst, limit.requests).run();
      }

      // Calculate token refill
      const timePassed = now - bucket.last_refill;
      const tokensToAdd = Math.floor((timePassed / limit.window) * limit.requests);
      const newTokens = Math.min(limit.burst, bucket.tokens + tokensToAdd);

      // Check if token available
      if (newTokens < 1) {
        // Log burst limit exceeded
        await this.logSecurityEvent({
          eventType: 'burst_limit_exceeded',
          limitKey: bucketKey,
          identifier,
          severity: 'low'
        });

        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.ceil((limit.window - timePassed) / 1000)
        };
      }

      // Consume token and update bucket
      const finalTokens = newTokens - 1;
      await this.db.db.prepare(`
        UPDATE token_buckets 
        SET tokens = ?, last_refill = ? 
        WHERE bucket_key = ?
      `).bind(finalTokens, now, bucketKey).run();

      return {
        allowed: true,
        remaining: finalTokens,
        retryAfter: 0
      };

    } catch (error) {
      console.error('Token bucket check failed:', error);
      // Fail open
      return { allowed: true, remaining: 0, retryAfter: 0 };
    }
  }

  // Combined rate limiting check
  async checkRateLimit(request, limitType, userId = null) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     '127.0.0.1';
    const userAgent = request.headers.get('User-Agent') || '';
    
    // Create composite key for different rate limiting strategies
    const ipKey = `ip:${clientIP}`;
    const userKey = userId ? `user:${userId}` : ipKey;
    const identifier = { ip: clientIP, userId, userAgent };

    try {
      // Check both sliding window and token bucket
      const [slidingResult, burstResult] = await Promise.all([
        this.checkSlidingWindow(userKey, limitType, JSON.stringify(identifier)),
        this.checkTokenBucket(userKey, `${limitType}_burst`, JSON.stringify(identifier))
      ]);

      // Also check IP-based limits for additional protection
      const ipResult = await this.checkSlidingWindow(ipKey, 'ip_global', JSON.stringify(identifier));

      // Request is allowed only if all checks pass
      const allowed = slidingResult.allowed && burstResult.allowed && ipResult.allowed;
      
      if (!allowed) {
        // Determine which limit was hit
        let reason = 'rate_limit';
        let retryAfter = Math.max(slidingResult.retryAfter, burstResult.retryAfter, ipResult.retryAfter);
        
        if (!ipResult.allowed) {
          reason = 'ip_rate_limit';
          retryAfter = ipResult.retryAfter;
        } else if (!burstResult.allowed) {
          reason = 'burst_limit';
          retryAfter = burstResult.retryAfter;
        }

        return {
          allowed: false,
          reason,
          retryAfter,
          headers: {
            'X-RateLimit-Limit': this.limits[limitType]?.requests || 0,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': Math.ceil((Date.now() + retryAfter * 1000) / 1000),
            'Retry-After': retryAfter
          }
        };
      }

      return {
        allowed: true,
        headers: {
          'X-RateLimit-Limit': this.limits[limitType]?.requests || 0,
          'X-RateLimit-Remaining': Math.min(slidingResult.remaining, burstResult.remaining),
          'X-RateLimit-Reset': Math.ceil(slidingResult.resetTime / 1000)
        }
      };

    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open but log the error
      await this.logSecurityEvent({
        eventType: 'rate_limit_error',
        error: error.message,
        identifier: JSON.stringify(identifier),
        severity: 'high'
      });
      
      return { allowed: true, headers: {} };
    }
  }

  // Abuse detection based on patterns
  async checkAbusePatterns(clientIP, userId = null) {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const since = now - timeWindow;

    try {
      // Check for repeated violations
      const violations = await this.db.db.prepare(`
        SELECT COUNT(*) as count FROM security_events 
        WHERE client_ip = ? AND timestamp > ? AND severity IN ('medium', 'high', 'critical')
      `).bind(clientIP, since).first();

      const violationCount = violations?.count || 0;

      // Check for rapid request patterns
      const requests = await this.db.db.prepare(`
        SELECT COUNT(*) as count FROM rate_limit_log 
        WHERE identifier LIKE ? AND timestamp > ?
      `).bind(`%"ip":"${clientIP}"%`, since).first();

      const requestCount = requests?.count || 0;

      // Abuse detection thresholds
      const isAbusive = violationCount > 10 || requestCount > 1000; // Very aggressive usage

      if (isAbusive) {
        // Log abuse detection
        await this.logSecurityEvent({
          eventType: 'abuse_detected',
          clientIP,
          userId,
          violationCount,
          requestCount,
          severity: 'critical'
        });

        // Add to temporary blacklist
        await this.addToBlacklist(clientIP, 'Abuse detected', 60 * 60 * 1000); // 1 hour
      }

      return { isAbusive, violationCount, requestCount };

    } catch (error) {
      console.error('Abuse detection error:', error);
      return { isAbusive: false, violationCount: 0, requestCount: 0 };
    }
  }

  // Temporary blacklist management
  async addToBlacklist(clientIP, reason, duration = 60 * 60 * 1000) {
    const now = Date.now();
    const expiresAt = now + duration;

    await this.db.db.prepare(`
      INSERT OR REPLACE INTO ip_blacklist (ip_address, reason, created_at, expires_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).bind(clientIP, reason, now, expiresAt).run();
  }

  async isBlacklisted(clientIP) {
    const now = Date.now();
    
    const result = await this.db.db.prepare(`
      SELECT reason FROM ip_blacklist 
      WHERE ip_address = ? AND expires_at > ? AND is_active = 1
    `).bind(clientIP, now).first();

    return result ? { blacklisted: true, reason: result.reason } : { blacklisted: false };
  }

  // Cleanup expired data
  async cleanup() {
    const now = Date.now();
    const oldestTime = now - (24 * 60 * 60 * 1000); // Keep 24 hours of logs

    const cleanupPromises = [
      // Clean old rate limit logs
      this.db.db.prepare(`DELETE FROM rate_limit_log WHERE timestamp < ?`).bind(oldestTime).run(),
      
      // Clean expired blacklist entries
      this.db.db.prepare(`DELETE FROM ip_blacklist WHERE expires_at < ?`).bind(now).run(),
      
      // Clean old token buckets (inactive for 1 hour)
      this.db.db.prepare(`DELETE FROM token_buckets WHERE last_refill < ?`).bind(now - 60 * 60 * 1000).run()
    ];

    await Promise.all(cleanupPromises);
  }

  // Security event logging
  async logSecurityEvent(event) {
    try {
      await this.db.db.prepare(`
        INSERT INTO security_events (event_type, user_id, client_ip, user_agent, details, severity, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.eventType,
        event.userId || null,
        event.clientIP || null,
        event.userAgent || null,
        JSON.stringify(event),
        event.severity || 'info',
        Date.now()
      ).run();
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}