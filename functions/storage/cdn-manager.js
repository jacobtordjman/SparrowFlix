// functions/storage/cdn-manager.js - Free-Tier CDN Management (Phase 4.1)

/**
 * CDN Manager for SparrowFlix
 * Uses Cloudflare's free tier services:
 * - Cloudflare Pages for static assets
 * - Workers KV for metadata
 * - Edge caching for performance
 * - Fallback to Telegram for resilience
 */

export class CDNManager {
  constructor(env) {
    this.kv = env.CDN_STORAGE; // Cloudflare Workers KV namespace
    this.pagesUrl = env.PAGES_URL || 'https://sparrowflix.pages.dev';
    this.telegramFallback = env.TELEGRAM_FALLBACK === 'true';
  }

  /**
   * Generate CDN URL for video content
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality (360p, 720p, 1080p)
   * @param {string} segment - HLS segment number (optional)
   */
  getVideoUrl(movieId, quality = '720p', segment = null) {
    const basePath = `/videos/${movieId}/${quality}`;
    
    if (segment !== null) {
      // HLS segment URL
      return `${this.pagesUrl}${basePath}/segment_${segment}.ts`;
    } else {
      // Master playlist URL
      return `${this.pagesUrl}${basePath}/playlist.m3u8`;
    }
  }

  /**
   * Generate CDN URL for poster images
   * @param {string} movieId - Movie identifier
   * @param {string} type - Image type (poster, backdrop, thumbnail)
   * @param {string} size - Image size (small, medium, large)
   */
  getImageUrl(movieId, type = 'poster', size = 'medium') {
    return `${this.pagesUrl}/images/${movieId}/${type}_${size}.webp`;
  }

  /**
   * Store video metadata in KV
   * @param {string} movieId - Movie identifier
   * @param {Object} metadata - Video metadata
   */
  async storeVideoMetadata(movieId, metadata) {
    const key = `video:${movieId}`;
    const data = {
      ...metadata,
      uploadedAt: Date.now(),
      versions: metadata.versions || ['360p', '720p', '1080p'],
      totalSize: metadata.totalSize || 0,
      duration: metadata.duration || 0,
      hlsSegments: metadata.hlsSegments || 0
    };

    try {
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: 60 * 60 * 24 * 30 // 30 days
      });
      return true;
    } catch (error) {
      console.error('Failed to store video metadata:', error);
      return false;
    }
  }

  /**
   * Retrieve video metadata from KV
   * @param {string} movieId - Movie identifier
   */
  async getVideoMetadata(movieId) {
    const key = `video:${movieId}`;
    
    try {
      const data = await this.kv.get(key, 'json');
      return data;
    } catch (error) {
      console.error('Failed to retrieve video metadata:', error);
      return null;
    }
  }

  /**
   * Store image metadata in KV
   * @param {string} movieId - Movie identifier
   * @param {Object} imageData - Image metadata
   */
  async storeImageMetadata(movieId, imageData) {
    const key = `images:${movieId}`;
    
    try {
      await this.kv.put(key, JSON.stringify(imageData), {
        expirationTtl: 60 * 60 * 24 * 7 // 7 days
      });
      return true;
    } catch (error) {
      console.error('Failed to store image metadata:', error);
      return false;
    }
  }

  /**
   * Generate pre-signed URL with expiry for secure access
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality
   * @param {number} expiryMinutes - URL expiry in minutes
   */
  generateSecureUrl(movieId, quality = '720p', expiryMinutes = 60) {
    const expiry = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);
    const baseUrl = this.getVideoUrl(movieId, quality);
    
    // Simple signature system for free tier
    const payload = `${movieId}:${quality}:${expiry}`;
    const signature = this.createSignature(payload);
    
    return `${baseUrl}?expires=${expiry}&signature=${signature}`;
  }

  /**
   * Validate secure URL signature
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality
   * @param {number} expires - Expiry timestamp
   * @param {string} signature - URL signature
   */
  validateSecureUrl(movieId, quality, expires, signature) {
    // Check expiry
    if (Math.floor(Date.now() / 1000) > expires) {
      return false;
    }

    // Validate signature
    const payload = `${movieId}:${quality}:${expires}`;
    const expectedSignature = this.createSignature(payload);
    
    return signature === expectedSignature;
  }

  /**
   * Create HMAC signature for URL security
   * @param {string} payload - Data to sign
   */
  createSignature(payload) {
    // Simple hash for free tier - in production use proper HMAC
    const hash = this.simpleHash(payload);
    return hash.substring(0, 16); // Truncate for URL friendliness
  }

  /**
   * Simple hash function for free tier
   * @param {string} str - String to hash
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get fallback Telegram URL if CDN fails
   * @param {string} movieId - Movie identifier
   * @param {string} telegramFileId - Telegram file ID
   */
  async getFallbackUrl(movieId, telegramFileId) {
    if (!this.telegramFallback || !telegramFileId) {
      return null;
    }

    // Check if CDN version exists
    const metadata = await this.getVideoMetadata(movieId);
    if (metadata && metadata.cdnAvailable) {
      return null; // CDN is available, no fallback needed
    }

    // Return Telegram streaming URL
    return `/api/stream/${telegramFileId}`;
  }

  /**
   * Track CDN usage statistics
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality accessed
   * @param {number} bytesServed - Bytes served to user
   */
  async trackUsage(movieId, quality, bytesServed) {
    const today = new Date().toISOString().split('T')[0];
    const key = `usage:${today}`;
    
    try {
      const existing = await this.kv.get(key, 'json') || {};
      
      if (!existing[movieId]) {
        existing[movieId] = {};
      }
      
      if (!existing[movieId][quality]) {
        existing[movieId][quality] = { requests: 0, bytes: 0 };
      }
      
      existing[movieId][quality].requests += 1;
      existing[movieId][quality].bytes += bytesServed;
      
      await this.kv.put(key, JSON.stringify(existing), {
        expirationTtl: 60 * 60 * 24 * 90 // 90 days
      });
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  /**
   * Get usage statistics
   * @param {string} date - Date in YYYY-MM-DD format
   */
  async getUsageStats(date) {
    const key = `usage:${date}`;
    
    try {
      return await this.kv.get(key, 'json') || {};
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {};
    }
  }

  /**
   * Generate HLS master playlist
   * @param {string} movieId - Movie identifier
   * @param {Array} qualities - Available quality levels
   */
  generateMasterPlaylist(movieId, qualities = ['360p', '720p', '1080p']) {
    const bitrates = {
      '360p': 800000,   // 800 Kbps
      '720p': 2500000,  // 2.5 Mbps
      '1080p': 5000000  // 5 Mbps
    };

    const resolutions = {
      '360p': '640x360',
      '720p': '1280x720',
      '1080p': '1920x1080'
    };

    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    for (const quality of qualities) {
      const bandwidth = bitrates[quality];
      const resolution = resolutions[quality];
      const playlistUrl = `${quality}/playlist.m3u8`;

      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n`;
      playlist += `${playlistUrl}\n\n`;
    }

    return playlist;
  }

  /**
   * Generate HLS media playlist for specific quality
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality
   * @param {number} segmentCount - Number of segments
   * @param {number} segmentDuration - Duration of each segment in seconds
   */
  generateMediaPlaylist(movieId, quality, segmentCount, segmentDuration = 10) {
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';
    playlist += `#EXT-X-TARGETDURATION:${segmentDuration}\n`;
    playlist += '#EXT-X-MEDIA-SEQUENCE:0\n\n';

    for (let i = 0; i < segmentCount; i++) {
      playlist += `#EXTINF:${segmentDuration}.0,\n`;
      playlist += `segment_${i}.ts\n`;
    }

    playlist += '#EXT-X-ENDLIST\n';
    return playlist;
  }

  /**
   * Health check for CDN services
   */
  async healthCheck() {
    const status = {
      cdn: false,
      kv: false,
      fallback: false,
      timestamp: Date.now()
    };

    try {
      // Test KV availability
      await this.kv.put('health:check', 'ok', { expirationTtl: 60 });
      const test = await this.kv.get('health:check');
      status.kv = test === 'ok';
    } catch (error) {
      console.error('KV health check failed:', error);
    }

    try {
      // Test CDN availability with a HEAD request
      const response = await fetch(`${this.pagesUrl}/health`, { method: 'HEAD' });
      status.cdn = response.ok;
    } catch (error) {
      console.error('CDN health check failed:', error);
    }

    status.fallback = this.telegramFallback;
    return status;
  }
}