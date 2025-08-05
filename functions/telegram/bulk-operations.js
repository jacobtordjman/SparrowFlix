// functions/telegram/bulk-operations.js - Bulk Operations Handler (Phase 5.1)

/**
 * Bulk Operations System for Streamlined Bot
 * Handles bulk movie/show additions, file processing, and content management
 * Implements proper timeouts, progress tracking, and cancellation
 */

import { D1Database } from '../db/d1-connection.js';

export class BulkOperationsHandler {
  constructor(env) {
    this.env = env;
    this.db = new D1Database(env.DB);
    this.activeOperations = new Map();
    this.maxConcurrentOperations = 3; // Free tier limitation
    this.batchSize = 10; // Process 10 items at a time
    this.operationTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Start bulk movie addition operation
   * @param {string} chatId - Chat ID
   * @param {string} userId - User ID
   * @param {Array|string} movieData - Movie data (array or CSV/JSON string)
   */
  async startBulkMovieAdd(chatId, userId, movieData) {
    if (this.activeOperations.size >= this.maxConcurrentOperations) {
      return {
        success: false,
        error: 'Maximum concurrent operations reached. Please wait for current operations to complete.'
      };
    }

    const operationId = `bulk_movie_${Date.now()}`;
    let movies = [];

    try {
      // Parse movie data
      if (typeof movieData === 'string') {
        // Try to parse as JSON first, then CSV
        try {
          movies = JSON.parse(movieData);
        } catch (jsonError) {
          movies = this.parseCSV(movieData);
        }
      } else if (Array.isArray(movieData)) {
        movies = movieData;
      } else {
        throw new Error('Invalid movie data format');
      }

      if (!movies.length) {
        throw new Error('No movies found in data');
      }

      // Create operation record
      const operation = {
        id: operationId,
        type: 'bulk_movie_add',
        chatId,
        userId,
        totalItems: movies.length,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        status: 'queued',
        data: movies,
        startTime: Date.now(),
        errors: []
      };

      this.activeOperations.set(operationId, operation);

      // Log to database
      await this.logBulkOperation(operation);

      // Start processing (non-blocking)
      this.processBulkOperation(operationId);

      return {
        success: true,
        operationId,
        totalItems: movies.length,
        estimatedTime: Math.ceil(movies.length / this.batchSize) * 30 // seconds
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start bulk TV show addition operation
   * @param {string} chatId - Chat ID
   * @param {string} userId - User ID
   * @param {Array|string} showData - Show data
   */
  async startBulkShowAdd(chatId, userId, showData) {
    if (this.activeOperations.size >= this.maxConcurrentOperations) {
      return {
        success: false,
        error: 'Maximum concurrent operations reached'
      };
    }

    const operationId = `bulk_show_${Date.now()}`;
    let shows = [];

    try {
      // Parse show data
      if (typeof showData === 'string') {
        try {
          shows = JSON.parse(showData);
        } catch (jsonError) {
          shows = this.parseCSV(showData);
        }
      } else if (Array.isArray(showData)) {
        shows = showData;
      }

      const operation = {
        id: operationId,
        type: 'bulk_show_add',
        chatId,
        userId,
        totalItems: shows.length,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        status: 'queued',
        data: shows,
        startTime: Date.now(),
        errors: []
      };

      this.activeOperations.set(operationId, operation);
      await this.logBulkOperation(operation);
      this.processBulkOperation(operationId);

      return {
        success: true,
        operationId,
        totalItems: shows.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process bulk operation in batches
   * @param {string} operationId - Operation ID
   */
  async processBulkOperation(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    try {
      operation.status = 'processing';
      await this.updateBulkOperationStatus(operation);

      // Send initial progress message
      await this.sendProgressUpdate(operation);

      // Process in batches
      for (let i = 0; i < operation.data.length; i += this.batchSize) {
        // Check for cancellation or timeout
        if (operation.status === 'cancelled' || 
            Date.now() - operation.startTime > this.operationTimeout) {
          operation.status = 'cancelled';
          break;
        }

        const batch = operation.data.slice(i, i + this.batchSize);
        await this.processBatch(operation, batch);

        // Send progress update every batch
        await this.sendProgressUpdate(operation);

        // Small delay between batches
        await this.sleep(1000);
      }

      // Finalize operation
      operation.status = operation.status === 'cancelled' ? 'cancelled' : 'completed';
      operation.completedTime = Date.now();
      await this.updateBulkOperationStatus(operation);
      await this.sendFinalUpdate(operation);

    } catch (error) {
      console.error(`Bulk operation ${operationId} failed:`, error);
      operation.status = 'failed';
      operation.errors.push(error.message);
      await this.updateBulkOperationStatus(operation);
      await this.sendErrorUpdate(operation, error);
    } finally {
      // Cleanup after delay
      setTimeout(() => {
        this.activeOperations.delete(operationId);
      }, 60000); // Keep for 1 minute for status queries
    }
  }

  /**
   * Process a batch of items
   * @param {Object} operation - Operation object
   * @param {Array} batch - Batch of items to process
   */
  async processBatch(operation, batch) {
    const promises = batch.map(async (item) => {
      try {
        if (operation.type === 'bulk_movie_add') {
          await this.addSingleMovie(item);
        } else if (operation.type === 'bulk_show_add') {
          await this.addSingleShow(item);
        }
        
        operation.successfulItems++;
      } catch (error) {
        operation.failedItems++;
        operation.errors.push({
          item: item.title || item.name || 'Unknown',
          error: error.message
        });
      }
      
      operation.processedItems++;
    });

    await Promise.allSettled(promises);
  }

  /**
   * Add single movie to database
   * @param {Object} movieData - Movie data
   */
  async addSingleMovie(movieData) {
    const movie = {
      id: movieData.id || `movie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: movieData.title,
      year: movieData.year,
      genre: movieData.genre || movieData.genres,
      overview: movieData.overview || movieData.description,
      poster: movieData.poster || movieData.poster_path,
      backdrop: movieData.backdrop || movieData.backdrop_path,
      tmdb_id: movieData.tmdb_id,
      imdb_id: movieData.imdb_id,
      file_id: movieData.file_id,
      file_size: movieData.file_size,
      duration: movieData.duration,
      rating: movieData.rating || movieData.vote_average
    };

    await this.db.createMovie(movie);
  }

  /**
   * Add single TV show to database
   * @param {Object} showData - Show data
   */
  async addSingleShow(showData) {
    const show = {
      id: showData.id || `show_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: showData.title || showData.name,
      year: showData.year || showData.first_air_date?.split('-')[0],
      genre: showData.genre || showData.genres,
      overview: showData.overview || showData.description,
      poster: showData.poster || showData.poster_path,
      backdrop: showData.backdrop || showData.backdrop_path,
      tmdb_id: showData.tmdb_id,
      seasons: showData.seasons || showData.number_of_seasons,
      status: showData.status || 'Unknown'
    };

    await this.db.createShow(show);

    // Add episodes if provided
    if (showData.episodes && Array.isArray(showData.episodes)) {
      for (const episodeData of showData.episodes) {
        const episode = {
          id: episodeData.id || `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          show_id: show.id,
          season: episodeData.season || 1,
          episode: episodeData.episode || 1,
          title: episodeData.title || episodeData.name,
          overview: episodeData.overview || episodeData.description,
          air_date: episodeData.air_date,
          file_id: episodeData.file_id,
          file_size: episodeData.file_size,
          duration: episodeData.duration
        };

        await this.db.createEpisode(episode);
      }
    }
  }

  /**
   * Parse CSV data into array of objects
   * @param {string} csvData - CSV string
   */
  parseCSV(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }

    return data;
  }

  /**
   * Get operation status
   * @param {string} operationId - Operation ID
   */
  getOperationStatus(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return { found: false, error: 'Operation not found' };
    }

    return {
      found: true,
      id: operation.id,
      type: operation.type,
      status: operation.status,
      totalItems: operation.totalItems,
      processedItems: operation.processedItems,
      successfulItems: operation.successfulItems,
      failedItems: operation.failedItems,
      progress: Math.round((operation.processedItems / operation.totalItems) * 100),
      errors: operation.errors.slice(-5), // Last 5 errors
      estimatedTimeRemaining: this.calculateEstimatedTime(operation)
    };
  }

  /**
   * Cancel operation
   * @param {string} operationId - Operation ID
   */
  cancelOperation(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return { success: false, error: 'Operation not found' };
    }

    if (operation.status === 'completed' || operation.status === 'failed') {
      return { success: false, error: 'Operation already finished' };
    }

    operation.status = 'cancelled';
    return { success: true };
  }

  /**
   * Get all active operations
   */
  getActiveOperations() {
    return Array.from(this.activeOperations.values()).map(op => ({
      id: op.id,
      type: op.type,
      status: op.status,
      totalItems: op.totalItems,
      processedItems: op.processedItems,
      progress: Math.round((op.processedItems / op.totalItems) * 100),
      startTime: op.startTime
    }));
  }

  /**
   * Calculate estimated time remaining
   * @param {Object} operation - Operation object
   */
  calculateEstimatedTime(operation) {
    if (operation.processedItems === 0) return 'Unknown';
    
    const elapsed = Date.now() - operation.startTime;
    const avgTimePerItem = elapsed / operation.processedItems;
    const remainingItems = operation.totalItems - operation.processedItems;
    const estimatedRemaining = remainingItems * avgTimePerItem;
    
    return Math.ceil(estimatedRemaining / 1000); // seconds
  }

  /**
   * Send progress update to user
   * @param {Object} operation - Operation object
   */
  async sendProgressUpdate(operation) {
    try {
      const { StreamlinedBot } = await import('./streamlined-bot.js');
      const bot = new StreamlinedBot(this.env.TELEGRAM_BOT_TOKEN, this.env);
      
      const progress = Math.round((operation.processedItems / operation.totalItems) * 100);
      const progressBar = this.createProgressBar(progress);
      
      const message = `🔄 **Bulk Operation Progress**\n\n` +
                     `**Type**: ${operation.type.replace('_', ' ').toUpperCase()}\n` +
                     `**Progress**: ${progress}% ${progressBar}\n` +
                     `**Processed**: ${operation.processedItems}/${operation.totalItems}\n` +
                     `**Successful**: ${operation.successfulItems}\n` +
                     `**Failed**: ${operation.failedItems}\n\n` +
                     `**Estimated time remaining**: ${this.calculateEstimatedTime(operation)}s`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Details', callback_data: `bulk:details:${operation.id}` },
            { text: '❌ Cancel', callback_data: `bulk:cancel:${operation.id}` }
          ]
        ]
      };

      await bot.sendMessage(operation.chatId, message, { reply_markup: keyboard });
      
    } catch (error) {
      console.error('Failed to send progress update:', error);
    }
  }

  /**
   * Send final operation update
   * @param {Object} operation - Operation object
   */
  async sendFinalUpdate(operation) {
    try {
      const { StreamlinedBot } = await import('./streamlined-bot.js');
      const bot = new StreamlinedBot(this.env.TELEGRAM_BOT_TOKEN, this.env);
      
      const duration = Math.round((operation.completedTime - operation.startTime) / 1000);
      const statusIcon = operation.status === 'completed' ? '✅' : 
                        operation.status === 'cancelled' ? '🚫' : '❌';
      
      let message = `${statusIcon} **Bulk Operation ${operation.status.toUpperCase()}**\n\n` +
                   `**Type**: ${operation.type.replace('_', ' ').toUpperCase()}\n` +
                   `**Total Items**: ${operation.totalItems}\n` +
                   `**Successful**: ${operation.successfulItems}\n` +
                   `**Failed**: ${operation.failedItems}\n` +
                   `**Duration**: ${duration}s\n\n`;

      if (operation.errors.length > 0) {
        message += `**Recent Errors**:\n`;
        operation.errors.slice(-3).forEach(error => {
          if (typeof error === 'object') {
            message += `• ${error.item}: ${error.error}\n`;
          } else {
            message += `• ${error}\n`;
          }
        });
      }

      await bot.sendMessage(operation.chatId, message);
      
    } catch (error) {
      console.error('Failed to send final update:', error);
    }
  }

  /**
   * Send error update
   * @param {Object} operation - Operation object
   * @param {Error} error - Error object
   */
  async sendErrorUpdate(operation, error) {
    try {
      const { StreamlinedBot } = await import('./streamlined-bot.js');
      const bot = new StreamlinedBot(this.env.TELEGRAM_BOT_TOKEN, this.env);
      
      const message = `❌ **Bulk Operation Failed**\n\n` +
                     `**Type**: ${operation.type.replace('_', ' ').toUpperCase()}\n` +
                     `**Error**: ${error.message}\n` +
                     `**Processed**: ${operation.processedItems}/${operation.totalItems}\n` +
                     `**Successful**: ${operation.successfulItems}\n\n` +
                     `The operation has been stopped. You can retry or contact support.`;

      await bot.sendMessage(operation.chatId, message);
      
    } catch (sendError) {
      console.error('Failed to send error update:', sendError);
    }
  }

  /**
   * Create progress bar visual
   * @param {number} progress - Progress percentage
   */
  createProgressBar(progress) {
    const barLength = 10;
    const filledLength = Math.round((progress / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    return `[${bar}]`;
  }

  /**
   * Log bulk operation to database
   * @param {Object} operation - Operation object
   */
  async logBulkOperation(operation) {
    try {
      await this.db.prepare(`
        INSERT OR REPLACE INTO bot_bulk_operations 
        (id, operation_type, chat_id, user_id, total_items, processed_items, 
         successful_items, failed_items, status, data, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        operation.id,
        operation.type,
        operation.chatId,
        operation.userId,
        operation.totalItems,
        operation.processedItems,
        operation.successfulItems,
        operation.failedItems,
        operation.status,
        JSON.stringify({ itemCount: operation.totalItems })
      ).run();
    } catch (error) {
      console.error('Failed to log bulk operation:', error);
    }
  }

  /**
   * Update bulk operation status in database
   * @param {Object} operation - Operation object
   */
  async updateBulkOperationStatus(operation) {
    try {
      await this.db.prepare(`
        UPDATE bot_bulk_operations 
        SET processed_items = ?, successful_items = ?, failed_items = ?, 
            status = ?, completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') 
            THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id = ?
      `).bind(
        operation.processedItems,
        operation.successfulItems,
        operation.failedItems,
        operation.status,
        operation.status,
        operation.id
      ).run();
    } catch (error) {
      console.error('Failed to update bulk operation status:', error);
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