// functions/telegram/webhook-security.js - Webhook Security & Validation (Phase 5.2)

/**
 * Telegram Webhook Security System
 * Implements HMAC validation, request queuing, and idempotency
 * Ensures secure and reliable webhook processing
 */

import crypto from 'crypto';

export class WebhookSecurity {
  constructor(botToken, env) {
    this.botToken = botToken;
    this.env = env;
    this.secretKey = this.generateSecretKey(botToken);
    
    // Request tracking
    this.processedUpdates = new Set();
    this.updateQueue = [];
    this.processing = false;
    
    // Rate limiting
    this.requestCounts = new Map();
    this.maxRequestsPerMinute = 30;
    this.cleanupInterval = 60 * 1000; // 1 minute
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Generate secret key for HMAC validation
   * @param {string} botToken - Bot token
   */
  generateSecretKey(botToken) {
    return crypto.createHash('sha256').update(botToken).digest('hex');
  }

  /**
   * Validate webhook request using HMAC
   * @param {Request} request - Incoming request
   * @param {string} body - Request body
   */
  async validateWebhook(request, body) {
    try {
      // Get Telegram signature from headers
      const telegramSignature = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      
      if (!telegramSignature) {
        console.warn('Missing Telegram signature header');
        return { valid: false, reason: 'Missing signature' };
      }

      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(body)
        .digest('hex');

      // Compare signatures (constant-time comparison)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(telegramSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        console.warn('Invalid webhook signature');
        return { valid: false, reason: 'Invalid signature' };
      }

      // Additional validation checks
      const contentType = request.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        return { valid: false, reason: 'Invalid content type' };
      }

      // Check request size (prevent DoS)
      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > 1024 * 1024) { // 1MB limit
        return { valid: false, reason: 'Request too large' };
      }

      return { valid: true };

    } catch (error) {
      console.error('Webhook validation error:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Check rate limits for incoming requests
   * @param {string} sourceIP - Source IP address
   */
  checkRateLimit(sourceIP) {
    const now = Date.now();
    const windowStart = now - (60 * 1000); // 1 minute window
    
    // Get or create request log for this IP
    if (!this.requestCounts.has(sourceIP)) {
      this.requestCounts.set(sourceIP, []);
    }
    
    const requests = this.requestCounts.get(sourceIP);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    this.requestCounts.set(sourceIP, recentRequests);
    
    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        resetTime: Math.min(...recentRequests) + (60 * 1000)
      };
    }
    
    // Add current request
    recentRequests.push(now);
    this.requestCounts.set(sourceIP, recentRequests);
    
    return { 
      allowed: true,
      remaining: this.maxRequestsPerMinute - recentRequests.length
    };
  }

  /**
   * Queue update for processing with idempotency
   * @param {Object} update - Telegram update
   * @param {string} sourceIP - Source IP
   */
  async queueUpdate(update, sourceIP) {
    // Generate update ID for idempotency
    const updateId = this.generateUpdateId(update);
    
    // Check if already processed (idempotency)
    if (this.processedUpdates.has(updateId)) {
      console.log(`Duplicate update ignored: ${updateId}`);
      return { queued: false, reason: 'Duplicate update' };
    }
    
    // Add to queue
    const queueItem = {
      id: updateId,
      update,
      sourceIP,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.updateQueue.push(queueItem);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
    
    return { 
      queued: true, 
      queuePosition: this.updateQueue.length,
      updateId 
    };
  }

  /**
   * Generate unique ID for update (for idempotency)
   * @param {Object} update - Telegram update
   */
  generateUpdateId(update) {
    // Use update_id if available, otherwise create hash from content
    if (update.update_id) {
      return `update_${update.update_id}`;
    }
    
    // Create hash from update content
    const content = JSON.stringify(update);
    return `hash_${crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)}`;
  }

  /**
   * Process queued updates
   */
  async processQueue() {
    if (this.processing || this.updateQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    console.log(`Processing ${this.updateQueue.length} queued updates`);
    
    while (this.updateQueue.length > 0) {
      const queueItem = this.updateQueue.shift();
      
      try {
        // Process the update
        await this.processUpdate(queueItem);
        
        // Mark as processed
        this.processedUpdates.add(queueItem.id);
        
        // Log successful processing
        await this.logUpdate(queueItem, 'success');
        
      } catch (error) {
        console.error(`Failed to process update ${queueItem.id}:`, error);
        
        // Retry logic
        if (queueItem.retryCount < 3) {
          queueItem.retryCount++;
          queueItem.nextRetry = Date.now() + (queueItem.retryCount * 30000); // 30s, 60s, 90s
          this.updateQueue.push(queueItem);
          console.log(`Retrying update ${queueItem.id} (attempt ${queueItem.retryCount + 1})`);
        } else {
          console.error(`Giving up on update ${queueItem.id} after 3 attempts`);
          await this.logUpdate(queueItem, 'failed', error.message);
        }
      }
      
      // Small delay between updates to prevent overwhelming
      await this.sleep(100);
    }
    
    this.processing = false;
    console.log('Update queue processing completed');
  }

  /**
   * Process individual update
   * @param {Object} queueItem - Queue item containing update
   */
  async processUpdate(queueItem) {
    const { StreamlinedBot } = await import('./streamlined-bot.js');
    const bot = new StreamlinedBot(this.botToken, this.env);
    
    // Process the update through the bot
    await bot.handleUpdate(queueItem.update);
  }

  /**
   * Log update processing to database
   * @param {Object} queueItem - Queue item
   * @param {string} status - Processing status
   * @param {string} error - Error message if failed
   */
  async logUpdate(queueItem, status, error = null) {
    try {
      const db = new (await import('../db/d1-connection.js')).D1Database(this.env.DB);
      
      await db.prepare(`
        INSERT INTO webhook_log (
          update_id, source_ip, status, error_message, 
          processing_time, retry_count, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        queueItem.id,
        queueItem.sourceIP,
        status,
        error,
        Date.now() - queueItem.timestamp,
        queueItem.retryCount
      ).run();
      
    } catch (logError) {
      console.error('Failed to log update:', logError);
    }
  }

  /**
   * Clean up old processed updates and request counts
   */
  cleanup() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Clean up processed updates (keep for 1 hour for idempotency)
    const oldUpdates = Array.from(this.processedUpdates).filter(updateId => {
      const timestamp = this.extractTimestampFromUpdateId(updateId);
      return timestamp && timestamp < oneHourAgo;
    });
    
    oldUpdates.forEach(updateId => this.processedUpdates.delete(updateId));
    
    // Clean up old request counts
    for (const [ip, requests] of this.requestCounts.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > oneHourAgo);
      if (recentRequests.length === 0) {
        this.requestCounts.delete(ip);
      } else {
        this.requestCounts.set(ip, recentRequests);
      }
    }
    
    console.log(`Cleanup completed: removed ${oldUpdates.length} old updates`);
  }

  /**
   * Extract timestamp from update ID (if possible)
   * @param {string} updateId - Update ID
   */
  extractTimestampFromUpdateId(updateId) {
    if (updateId.startsWith('update_')) {
      // For Telegram update IDs, we can't extract timestamp
      return null;
    }
    
    if (updateId.startsWith('hash_')) {
      // For hash-based IDs, we don't have timestamp info
      return null;
    }
    
    return null;
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Get webhook statistics
   */
  getStats() {
    return {
      processedUpdates: this.processedUpdates.size,
      queueLength: this.updateQueue.length,
      processing: this.processing,
      activeIPs: this.requestCounts.size,
      totalRequests: Array.from(this.requestCounts.values())
        .reduce((total, requests) => total + requests.length, 0)
    };
  }

  /**
   * Validate webhook setup
   * @param {string} webhookUrl - Webhook URL
   */
  async validateWebhookSetup(webhookUrl) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getWebhookInfo`);
      const result = await response.json();
      
      if (!result.ok) {
        return { valid: false, error: result.description };
      }
      
      const info = result.result;
      
      return {
        valid: info.url === webhookUrl,
        url: info.url,
        hasCustomCertificate: info.has_custom_certificate,
        pendingUpdateCount: info.pending_update_count,
        lastErrorDate: info.last_error_date,
        lastErrorMessage: info.last_error_message,
        maxConnections: info.max_connections
      };
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Set webhook with proper security
   * @param {string} webhookUrl - Webhook URL
   */
  async setWebhook(webhookUrl) {
    try {
      const payload = {
        url: webhookUrl,
        secret_token: this.secretKey,
        max_connections: 10, // Conservative for free tier
        allowed_updates: ['message', 'callback_query'], // Only what we need
        drop_pending_updates: true // Start fresh
      };
      
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.description);
      }
      
      console.log('Webhook set successfully with security token');
      return { success: true };
      
    } catch (error) {
      console.error('Failed to set webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sleep utility function
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main webhook handler function
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment variables
 */
export async function handleSecureWebhook(request, env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return new Response('Bot token not configured', { status: 500 });
  }
  
  const security = new WebhookSecurity(botToken, env);
  const sourceIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   '127.0.0.1';
  
  try {
    // Check rate limits
    const rateLimit = security.checkRateLimit(sourceIP);
    if (!rateLimit.allowed) {
      return new Response('Rate limit exceeded', { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
        }
      });
    }
    
    // Get request body
    const body = await request.text();
    
    // Validate webhook signature
    const validation = await security.validateWebhook(request, body);
    if (!validation.valid) {
      console.warn(`Webhook validation failed: ${validation.reason}`);
      return new Response('Forbidden', { status: 403 });
    }
    
    // Parse update
    let update;
    try {
      update = JSON.parse(body);
    } catch (error) {
      console.error('Invalid JSON in webhook:', error);
      return new Response('Bad Request', { status: 400 });
    }
    
    // Queue update for processing
    const queueResult = await security.queueUpdate(update, sourceIP);
    
    if (!queueResult.queued) {
      console.log(`Update not queued: ${queueResult.reason}`);
    }
    
    // Always return 200 OK to Telegram
    return new Response('OK', { 
      status: 200,
      headers: {
        'X-Remaining-Requests': rateLimit.remaining?.toString() || '0',
        'X-Queue-Position': queueResult.queuePosition?.toString() || '0'
      }
    });
    
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}