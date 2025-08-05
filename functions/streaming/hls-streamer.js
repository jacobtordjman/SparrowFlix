// functions/streaming/hls-streamer.js - HLS Streaming Pipeline (Phase 4.2)

/**
 * HLS Streaming Pipeline for SparrowFlix
 * Provides adaptive bitrate streaming with bandwidth detection
 * Uses free-tier CDN with Telegram fallback
 */

import { CDNManager } from '../storage/cdn-manager.js';

export class HLSStreamer {
  constructor(env) {
    this.cdnManager = new CDNManager(env);
    this.db = env.DB;
    
    // Quality levels configuration
    this.qualityLevels = [
      { name: '360p', bandwidth: 800000, resolution: '640x360' },
      { name: '720p', bandwidth: 2500000, resolution: '1280x720' },
      { name: '1080p', bandwidth: 5000000, resolution: '1920x1080' }
    ];
    
    // Streaming configuration
    this.segmentDuration = 10; // seconds
    this.bufferLength = 30; // seconds
    this.maxRetries = 3;
  }

  /**
   * Generate streaming response for a movie
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Requested quality (optional)
   * @param {Object} userAgent - User agent info for device detection
   */
  async getStreamingResponse(movieId, quality = null, userAgent = {}) {
    try {
      // Check if movie exists and is available
      const movie = await this.getMovieInfo(movieId);
      if (!movie) {
        return this.createErrorResponse('Movie not found', 404);
      }

      // Determine best quality based on user's device and bandwidth
      const targetQuality = quality || this.selectOptimalQuality(userAgent);
      
      // Check CDN availability first
      if (movie.cdn_available) {
        const cdnResponse = await this.streamFromCDN(movieId, targetQuality);
        if (cdnResponse.success) {
          await this.trackStreamingEvent(movieId, targetQuality, 'cdn');
          return cdnResponse.response;
        }
      }

      // Fallback to Telegram streaming
      if (movie.telegram_file_id) {
        const telegramResponse = await this.streamFromTelegram(movie.telegram_file_id, targetQuality);
        if (telegramResponse.success) {
          await this.trackStreamingEvent(movieId, targetQuality, 'telegram');
          return telegramResponse.response;
        }
      }

      return this.createErrorResponse('Stream not available', 503);

    } catch (error) {
      console.error('Streaming error:', error);
      return this.createErrorResponse('Internal streaming error', 500);
    }
  }

  /**
   * Stream from CDN (Cloudflare Pages)
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality
   */
  async streamFromCDN(movieId, quality) {
    try {
      // Get CDN metadata
      const metadata = await this.cdnManager.getVideoMetadata(movieId);
      if (!metadata || !metadata.versions.includes(quality)) {
        return { success: false, error: 'Quality not available on CDN' };
      }

      // Generate secure URL
      const streamUrl = this.cdnManager.generateSecureUrl(movieId, quality, 120); // 2 hour expiry
      
      // Create HLS master playlist
      const masterPlaylist = this.generateMasterPlaylist(movieId, metadata.versions);
      
      return {
        success: true,
        response: new Response(masterPlaylist, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'max-age=300', // 5 minutes
            'Access-Control-Allow-Origin': '*',
            'X-Stream-Source': 'cdn'
          }
        })
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Stream from Telegram (fallback)
   * @param {string} telegramFileId - Telegram file ID
   * @param {string} quality - Video quality
   */
  async streamFromTelegram(telegramFileId, quality) {
    try {
      // For Telegram, we can't provide multiple qualities,
      // so we stream the original file with dynamic quality selection
      const streamUrl = `/api/telegram-stream/${telegramFileId}`;
      
      // Create simple HLS playlist for Telegram streaming
      const playlist = this.generateTelegramPlaylist(streamUrl, quality);
      
      return {
        success: true,
        response: new Response(playlist, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'max-age=60', // 1 minute (shorter for fallback)
            'Access-Control-Allow-Origin': '*',
            'X-Stream-Source': 'telegram'
          }
        })
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get HLS segment
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality
   * @param {number} segmentNumber - Segment number
   */
  async getHLSSegment(movieId, quality, segmentNumber) {
    try {
      // Check CDN first
      const cdnUrl = this.cdnManager.getVideoUrl(movieId, quality, segmentNumber);
      
      // Proxy the segment request
      const response = await fetch(cdnUrl);
      if (response.ok) {
        return new Response(response.body, {
          headers: {
            'Content-Type': 'video/mp2t',
            'Cache-Control': 'max-age=3600', // 1 hour
            'Access-Control-Allow-Origin': '*',
            'X-Segment-Source': 'cdn'
          }
        });
      }

      // Fallback to Telegram if needed
      return this.getTelegramSegment(movieId, segmentNumber);

    } catch (error) {
      console.error('Segment fetch error:', error);
      return new Response('Segment not available', { status: 404 });
    }
  }

  /**
   * Get Telegram segment (simulated)
   * @param {string} movieId - Movie identifier
   * @param {number} segmentNumber - Segment number
   */
  async getTelegramSegment(movieId, segmentNumber) {
    // For Telegram, we'd need to implement byte-range requests
    // This is a simplified implementation
    const movie = await this.getMovieInfo(movieId);
    if (!movie || !movie.telegram_file_id) {
      return new Response('Segment not available', { status: 404 });
    }

    // Calculate byte range for this segment
    const segmentSize = Math.floor(movie.file_size / 100); // Approximate
    const start = segmentNumber * segmentSize;
    const end = Math.min(start + segmentSize - 1, movie.file_size - 1);

    // Return range request URL (to be handled by telegram streaming endpoint)
    const rangeUrl = `/api/telegram-range/${movie.telegram_file_id}?start=${start}&end=${end}`;
    
    return Response.redirect(rangeUrl, 302);
  }

  /**
   * Generate HLS master playlist
   * @param {string} movieId - Movie identifier
   * @param {Array} availableQualities - Available quality levels
   */
  generateMasterPlaylist(movieId, availableQualities) {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    for (const qualityName of availableQualities) {
      const quality = this.qualityLevels.find(q => q.name === qualityName);
      if (quality) {
        playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bandwidth},RESOLUTION=${quality.resolution}\n`;
        playlist += `${qualityName}/playlist.m3u8\n\n`;
      }
    }

    return playlist;
  }

  /**
   * Generate media playlist for specific quality
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality
   * @param {number} segmentCount - Number of segments
   */
  async generateMediaPlaylist(movieId, quality, segmentCount = null) {
    if (!segmentCount) {
      const metadata = await this.cdnManager.getVideoMetadata(movieId);
      segmentCount = metadata?.hlsSegments || 100; // Default estimate
    }

    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';
    playlist += `#EXT-X-TARGETDURATION:${this.segmentDuration}\n`;
    playlist += '#EXT-X-MEDIA-SEQUENCE:0\n\n';

    for (let i = 0; i < segmentCount; i++) {
      playlist += `#EXTINF:${this.segmentDuration}.0,\n`;
      playlist += `segment_${i}.ts\n`;
    }

    playlist += '#EXT-X-ENDLIST\n';
    return playlist;
  }

  /**
   * Generate simplified playlist for Telegram streaming
   * @param {string} streamUrl - Stream URL
   * @param {string} quality - Target quality
   */
  generateTelegramPlaylist(streamUrl, quality) {
    const qualityInfo = this.qualityLevels.find(q => q.name === quality) || this.qualityLevels[1];
    
    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n';
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${qualityInfo.bandwidth},RESOLUTION=${qualityInfo.resolution}\n`;
    playlist += `${streamUrl}\n`;
    
    return playlist;
  }

  /**
   * Select optimal quality based on user agent and bandwidth
   * @param {Object} userAgent - User agent information
   */
  selectOptimalQuality(userAgent) {
    // Mobile devices get lower quality by default
    if (userAgent.isMobile) {
      return '720p';
    }

    // Slow connections get lower quality
    if (userAgent.connectionType === 'slow-2g' || userAgent.connectionType === '2g') {
      return '360p';
    }

    // Default to 720p for good balance of quality and bandwidth
    return '720p';
  }

  /**
   * Bandwidth detection endpoint
   * @param {Request} request - HTTP request
   */
  async handleBandwidthTest(request) {
    try {
      // Generate test data of different sizes
      const testSize = parseInt(request.url.searchParams.get('size')) || 1000000; // 1MB default
      const testData = 'x'.repeat(Math.min(testSize, 10000000)); // Max 10MB

      const startTime = Date.now();
      
      return new Response(testData, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'X-Test-Size': testSize.toString(),
          'X-Test-Start': startTime.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-Test-Size,X-Test-Start'
        }
      });

    } catch (error) {
      return new Response('Bandwidth test failed', { status: 500 });
    }
  }

  /**
   * Track streaming events for analytics
   * @param {string} movieId - Movie identifier
   * @param {string} quality - Video quality
   * @param {string} source - Stream source (cdn/telegram)
   */
  async trackStreamingEvent(movieId, quality, source) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Update usage statistics
      await this.db.prepare(`
        INSERT OR REPLACE INTO cdn_usage (date, movie_id, quality, requests, bytes_served)
        VALUES (?, ?, ?, 
          COALESCE((SELECT requests FROM cdn_usage WHERE date = ? AND movie_id = ? AND quality = ?), 0) + 1,
          COALESCE((SELECT bytes_served FROM cdn_usage WHERE date = ? AND movie_id = ? AND quality = ?), 0) + ?
        )
      `).bind(
        today, movieId, quality,
        today, movieId, quality,
        today, movieId, quality, this.estimateStreamSize(quality)
      ).run();

      // Update movie statistics
      await this.db.prepare(`
        INSERT OR REPLACE INTO movie_stats (movie_id, view_count, last_viewed, updated_at)
        VALUES (?, 
          COALESCE((SELECT view_count FROM movie_stats WHERE movie_id = ?), 0) + 1,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `).bind(movieId, movieId).run();

    } catch (error) {
      console.error('Failed to track streaming event:', error);
    }
  }

  /**
   * Get movie information
   * @param {string} movieId - Movie identifier
   */
  async getMovieInfo(movieId) {
    return await this.db.prepare(`
      SELECT m.*, mcd.qualities, mcd.total_size, mcd.segment_count
      FROM movies m
      LEFT JOIN movie_cdn_data mcd ON m.id = mcd.movie_id
      WHERE m.id = ?
    `).bind(movieId).first();
  }

  /**
   * Estimate stream size for analytics
   * @param {string} quality - Video quality
   */
  estimateStreamSize(quality) {
    const estimates = {
      '360p': 100000000,  // ~100MB per hour
      '720p': 300000000,  // ~300MB per hour
      '1080p': 500000000  // ~500MB per hour
    };
    
    return estimates[quality] || estimates['720p'];
  }

  /**
   * Create error response
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   */
  createErrorResponse(message, status) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /**
   * Get streaming statistics
   */
  async getStreamingStats() {
    const today = new Date().toISOString().split('T')[0];
    
    const dailyStats = await this.db.prepare(`
      SELECT 
        SUM(requests) as total_requests,
        SUM(bytes_served) as total_bytes,
        COUNT(DISTINCT movie_id) as unique_movies
      FROM cdn_usage 
      WHERE date = ?
    `).bind(today).first();

    const popularMovies = await this.db.prepare(`
      SELECT m.title, ms.view_count, ms.last_viewed
      FROM movie_stats ms
      JOIN movies m ON ms.movie_id = m.id
      ORDER BY ms.view_count DESC
      LIMIT 10
    `).all();

    return {
      today: {
        requests: dailyStats.total_requests || 0,
        bandwidth: dailyStats.total_bytes || 0,
        uniqueMovies: dailyStats.unique_movies || 0
      },
      popularMovies: popularMovies.results || []
    };
  }

  /**
   * Health check for streaming services
   */
  async healthCheck() {
    const cdnHealth = await this.cdnManager.healthCheck();
    
    return {
      status: cdnHealth.cdn && cdnHealth.kv ? 'healthy' : 'degraded',
      cdn: cdnHealth.cdn,
      kv: cdnHealth.kv,
      fallback: cdnHealth.fallback,
      timestamp: Date.now()
    };
  }
}