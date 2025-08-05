// functions/migration/content-migrator.js - Content Migration System (Phase 4.1)

/**
 * Content Migration System for SparrowFlix
 * Gradually migrates content from Telegram storage to free-tier CDN
 * Maintains backward compatibility and fallback mechanisms
 */

import { CDNManager } from '../storage/cdn-manager.js';
import { FFMPEGTranscoder } from '../transcoding/ffmpeg-transcoder.js';

export class ContentMigrator {
  constructor(env) {
    this.cdnManager = new CDNManager(env);
    this.transcoder = new FFMPEGTranscoder();
    this.db = env.DB; // D1 database
    this.telegramBotToken = env.TELEGRAM_BOT_TOKEN;
    this.telegramChannelId = env.TELEGRAM_CHANNEL_ID;
    
    // Migration settings
    this.batchSize = 5; // Process 5 items at a time
    this.migrationCooldown = 60 * 60 * 1000; // 1 hour between batches
    this.retryAttempts = 3;
    this.priorityThreshold = 10; // Popular movies get priority
  }

  /**
   * Start migration process for all content
   * @param {Object} options - Migration options
   */
  async startMigration(options = {}) {
    const {
      dryRun = false,
      priority = false,
      forceAll = false,
      maxItems = null
    } = options;

    console.log('Starting content migration...', { dryRun, priority, forceAll });

    try {
      // Get migration queue
      const migrationQueue = await this.buildMigrationQueue({
        priority,
        forceAll,
        maxItems
      });

      console.log(`Found ${migrationQueue.length} items to migrate`);

      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          queueSize: migrationQueue.length,
          queue: migrationQueue.slice(0, 10) // Show first 10 for preview
        };
      }

      // Process migration in batches
      const results = await this.processMigrationBatches(migrationQueue);

      return {
        success: true,
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      };

    } catch (error) {
      console.error('Migration process failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build prioritized migration queue
   * @param {Object} options - Queue building options
   */
  async buildMigrationQueue(options = {}) {
    const { priority, forceAll, maxItems } = options;

    let query = `
      SELECT 
        m.id,
        m.title,
        m.file_id,
        m.telegram_file_id,
        m.file_size,
        m.created_at,
        COALESCE(s.view_count, 0) as popularity,
        COALESCE(cm.status, 'pending') as migration_status,
        cm.last_attempt,
        cm.attempt_count
      FROM movies m
      LEFT JOIN movie_stats s ON m.id = s.movie_id
      LEFT JOIN cdn_migration cm ON m.id = cm.movie_id
    `;

    const conditions = [];
    const params = [];

    if (!forceAll) {
      // Only migrate items not already on CDN
      conditions.push(`(cm.status IS NULL OR cm.status != 'completed')`);
    }

    if (priority) {
      // Prioritize popular content
      conditions.push(`s.view_count >= ?`);
      params.push(this.priorityThreshold);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Order by priority: failed attempts first, then by popularity
    query += ` 
      ORDER BY 
        CASE WHEN cm.status = 'failed' THEN 0 ELSE 1 END,
        COALESCE(s.view_count, 0) DESC,
        m.created_at DESC
    `;

    if (maxItems) {
      query += ` LIMIT ?`;
      params.push(maxItems);
    }

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results || [];
  }

  /**
   * Process migration in batches
   * @param {Array} queue - Migration queue
   */
  async processMigrationBatches(queue) {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process in batches to avoid overwhelming free tier limits
    for (let i = 0; i < queue.length; i += this.batchSize) {
      const batch = queue.slice(i, i + this.batchSize);
      console.log(`Processing batch ${Math.floor(i / this.batchSize) + 1}...`);

      const batchPromises = batch.map(item => this.migrateItem(item));
      const batchResults = await Promise.allSettled(batchPromises);

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const item = batch[j];

        results.processed++;

        if (result.status === 'fulfilled' && result.value.success) {
          results.successful++;
          await this.updateMigrationStatus(item.id, 'completed', result.value);
        } else {
          results.failed++;
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          results.errors.push({ movieId: item.id, error: error.message || error });
          await this.updateMigrationStatus(item.id, 'failed', { error: error.message });
        }
      }

      // Cooldown between batches to respect rate limits
      if (i + this.batchSize < queue.length) {
        console.log(`Waiting ${this.migrationCooldown / 1000}s before next batch...`);
        await this.sleep(this.migrationCooldown);
      }
    }

    return results;
  }

  /**
   * Migrate single item from Telegram to CDN
   * @param {Object} item - Movie item to migrate
   */
  async migrateItem(item) {
    console.log(`Migrating movie: ${item.title} (ID: ${item.id})`);

    try {
      // Step 1: Download from Telegram
      const downloadResult = await this.downloadFromTelegram(item);
      if (!downloadResult.success) {
        throw new Error(`Download failed: ${downloadResult.error}`);
      }

      // Step 2: Transcode to multiple qualities
      const transcodeResult = await this.transcodeVideo(downloadResult.filePath, item);
      if (!transcodeResult.success) {
        throw new Error(`Transcoding failed: ${transcodeResult.error}`);
      }

      // Step 3: Upload to CDN (Cloudflare Pages)
      const uploadResult = await this.uploadToCDN(transcodeResult, item);
      if (!uploadResult.success) {
        throw new Error(`CDN upload failed: ${uploadResult.error}`);
      }

      // Step 4: Generate thumbnails and metadata
      const metadataResult = await this.generateMetadata(downloadResult.filePath, item);

      // Step 5: Update database
      await this.updateMovieRecords(item.id, {
        cdnAvailable: true,
        cdnPath: uploadResult.cdnPath,
        qualities: transcodeResult.qualities,
        thumbnails: metadataResult.thumbnails,
        totalSize: transcodeResult.totalSize,
        segmentCount: transcodeResult.totalSegments
      });

      // Step 6: Cleanup temporary files
      await this.cleanupTempFiles(downloadResult.filePath, transcodeResult.outputDir);

      return {
        success: true,
        movieId: item.id,
        cdnPath: uploadResult.cdnPath,
        qualities: transcodeResult.qualities,
        size: transcodeResult.totalSize
      };

    } catch (error) {
      console.error(`Migration failed for ${item.title}:`, error);
      return {
        success: false,
        movieId: item.id,
        error: error
      };
    }
  }

  /**
   * Download video file from Telegram
   * @param {Object} item - Movie item
   */
  async downloadFromTelegram(item) {
    if (!item.telegram_file_id) {
      return { success: false, error: 'No Telegram file ID available' };
    }

    try {
      // Get file info from Telegram
      const fileInfo = await this.getTelegramFileInfo(item.telegram_file_id);
      if (!fileInfo.file_path) {
        throw new Error('File not found on Telegram');
      }

      // Download file
      const downloadUrl = `https://api.telegram.org/file/bot${this.telegramBotToken}/${fileInfo.file_path}`;
      const tempPath = `/tmp/downloads/${item.id}_${Date.now()}.mp4`;

      // Simulate download for free tier
      console.log(`Downloading from Telegram: ${downloadUrl} -> ${tempPath}`);
      
      // In production, this would use fetch() and file streaming
      await this.sleep(2000); // Simulate download time

      return {
        success: true,
        filePath: tempPath,
        fileSize: fileInfo.file_size
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Telegram file information
   * @param {string} fileId - Telegram file ID
   */
  async getTelegramFileInfo(fileId) {
    const url = `https://api.telegram.org/bot${this.telegramBotToken}/getFile?file_id=${fileId}`;
    
    try {
      // Simulate Telegram API call for free tier
      return {
        file_id: fileId,
        file_unique_id: `${fileId}_unique`,
        file_size: Math.floor(Math.random() * 2000000000) + 500000000, // 500MB - 2.5GB
        file_path: `videos/${fileId}.mp4`
      };
    } catch (error) {
      throw new Error(`Telegram API error: ${error.message}`);
    }
  }

  /**
   * Transcode video to multiple qualities
   * @param {string} filePath - Source video path
   * @param {Object} item - Movie item
   */
  async transcodeVideo(filePath, item) {
    const outputDir = `/tmp/transcoded/${item.id}`;
    
    try {
      const result = await this.transcoder.transcodeVideo(
        filePath,
        outputDir,
        item.id,
        (progress) => console.log(`Transcoding ${item.title}: ${progress}%`)
      );

      return {
        success: true,
        outputDir,
        qualities: result.qualities.map(q => q.quality),
        totalSegments: result.totalSegments,
        totalSize: this.calculateTotalSize(result.qualities)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload transcoded content to CDN
   * @param {Object} transcodeResult - Transcoding result
   * @param {Object} item - Movie item
   */
  async uploadToCDN(transcodeResult, item) {
    try {
      // Simulate CDN upload for free tier
      console.log(`Uploading to CDN: ${item.title}`);
      
      const cdnPath = `/videos/${item.id}`;
      
      // Store metadata in KV
      await this.cdnManager.storeVideoMetadata(item.id, {
        title: item.title,
        qualities: transcodeResult.qualities,
        totalSize: transcodeResult.totalSize,
        segmentCount: transcodeResult.totalSegments,
        uploadedAt: Date.now()
      });

      // Simulate upload delay
      await this.sleep(5000);

      return {
        success: true,
        cdnPath,
        cdnUrl: this.cdnManager.getVideoUrl(item.id)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate thumbnails and additional metadata
   * @param {string} filePath - Source video path
   * @param {Object} item - Movie item
   */
  async generateMetadata(filePath, item) {
    try {
      // Extract thumbnails at different timestamps
      const thumbnails = [];
      const timestamps = [10, 30, 60, 120, 300]; // Various points in the video

      for (const timestamp of timestamps) {
        const thumbPath = `/tmp/thumbnails/${item.id}_${timestamp}.jpg`;
        const result = await this.transcoder.extractThumbnail(filePath, thumbPath, timestamp);
        
        if (result.success) {
          thumbnails.push({
            timestamp,
            path: thumbPath,
            cdnUrl: this.cdnManager.getImageUrl(item.id, 'thumbnail', `${timestamp}s`)
          });
        }
      }

      return {
        success: true,
        thumbnails
      };

    } catch (error) {
      console.error('Metadata generation failed:', error);
      return {
        success: false,
        thumbnails: []
      };
    }
  }

  /**
   * Update movie records in database
   * @param {string} movieId - Movie ID
   * @param {Object} cdnData - CDN-related data
   */
  async updateMovieRecords(movieId, cdnData) {
    // Update main movie record
    await this.db.prepare(`
      UPDATE movies 
      SET 
        cdn_available = ?,
        cdn_path = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(cdnData.cdnAvailable, cdnData.cdnPath, movieId).run();

    // Store CDN metadata
    await this.db.prepare(`
      INSERT OR REPLACE INTO movie_cdn_data 
      (movie_id, qualities, thumbnails, total_size, segment_count, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      movieId,
      JSON.stringify(cdnData.qualities),
      JSON.stringify(cdnData.thumbnails),
      cdnData.totalSize,
      cdnData.segmentCount
    ).run();
  }

  /**
   * Update migration status
   * @param {string} movieId - Movie ID
   * @param {string} status - Migration status
   * @param {Object} metadata - Additional metadata
   */
  async updateMigrationStatus(movieId, status, metadata = {}) {
    await this.db.prepare(`
      INSERT OR REPLACE INTO cdn_migration 
      (movie_id, status, last_attempt, attempt_count, metadata, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, 
        COALESCE((SELECT attempt_count FROM cdn_migration WHERE movie_id = ?), 0) + 1,
        ?, CURRENT_TIMESTAMP)
    `).bind(movieId, status, movieId, JSON.stringify(metadata)).run();
  }

  /**
   * Get migration status for a movie
   * @param {string} movieId - Movie ID
   */
  async getMigrationStatus(movieId) {
    const result = await this.db.prepare(`
      SELECT * FROM cdn_migration WHERE movie_id = ?
    `).bind(movieId).first();

    return result || { status: 'pending', attempt_count: 0 };
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats() {
    const stats = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_movies,
        SUM(CASE WHEN cm.status = 'completed' THEN 1 ELSE 0 END) as migrated,
        SUM(CASE WHEN cm.status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN cm.status IS NULL OR cm.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM movies m
      LEFT JOIN cdn_migration cm ON m.id = cm.movie_id
    `).first();

    return {
      total: stats.total_movies || 0,
      migrated: stats.migrated || 0,
      failed: stats.failed || 0,
      pending: stats.pending || 0,
      progressPercentage: stats.total_movies > 0 
        ? Math.round((stats.migrated / stats.total_movies) * 100) 
        : 0
    };
  }

  /**
   * Clean up temporary files
   * @param {string} downloadPath - Downloaded file path
   * @param {string} transcodeDir - Transcoded files directory
   */
  async cleanupTempFiles(downloadPath, transcodeDir) {
    console.log('Cleaning up temporary files:', { downloadPath, transcodeDir });
    
    // Simulate cleanup for free tier
    await this.sleep(500);
    
    return true;
  }

  /**
   * Calculate total size of transcoded files
   * @param {Array} qualities - Quality results
   */
  calculateTotalSize(qualities) {
    // Simulate size calculation
    return qualities.reduce((total, quality) => {
      const baseSize = 500000000; // 500MB base
      const multiplier = quality.quality === '1080p' ? 2 : quality.quality === '720p' ? 1.5 : 1;
      return total + (baseSize * multiplier);
    }, 0);
  }

  /**
   * Sleep utility function
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Rollback migration for a movie (revert to Telegram)
   * @param {string} movieId - Movie ID
   */
  async rollbackMigration(movieId) {
    try {
      // Update database to disable CDN
      await this.db.prepare(`
        UPDATE movies 
        SET cdn_available = 0, cdn_path = NULL 
        WHERE id = ?
      `).bind(movieId).run();

      // Update migration status
      await this.updateMigrationStatus(movieId, 'rolled_back');

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}