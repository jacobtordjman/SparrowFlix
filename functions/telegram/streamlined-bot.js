// functions/telegram/streamlined-bot.js - Streamlined Admin-Only Bot (Phase 5.1)

/**
 * Streamlined Telegram Bot for SparrowFlix Admin Operations
 * Removes complex state management and focuses on essential admin functions
 * Uses inline keyboards for all interactions and implements proper timeouts
 */

import { D1Database } from '../db/d1-connection.js';

export class StreamlinedBot {
  constructor(token, env) {
    this.token = token;
    this.env = env;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
    this.db = new D1Database(env.DB);
    
    // Bot configuration
    this.adminChatIds = (env.ADMIN_CHAT_IDS || '').split(',').filter(id => id.trim());
    this.commandTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxFileSize = 2000 * 1024 * 1024; // 2GB Telegram limit
    
    // Active operations tracking (no complex state)
    this.activeOperations = new Map();
  }

  /**
   * Handle incoming webhook update
   * @param {Object} update - Telegram update object
   */
  async handleUpdate(update) {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
      console.error('Bot error:', error);
      await this.logError('handleUpdate', error, update);
    }
  }

  /**
   * Handle incoming messages
   * @param {Object} message - Telegram message object
   */
  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const userId = message.from.id;

    // Admin-only access control
    if (!this.isAdmin(chatId, userId)) {
      await this.sendMessage(chatId, '🚫 Access denied. This bot is for administrators only.');
      return;
    }

    // Clean up expired operations
    this.cleanupExpiredOperations();

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(message);
    } else if (message.document || message.video) {
      await this.handleFileUpload(message);
    } else {
      // No complex state management - just show help for non-commands
      await this.sendHelpMessage(chatId);
    }
  }

  /**
   * Handle bot commands
   * @param {Object} message - Telegram message object
   */
  async handleCommand(message) {
    const chatId = message.chat.id;
    const command = message.text.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start':
        await this.sendWelcomeMessage(chatId);
        break;
      
      case '/add_movie':
        await this.startAddMovie(chatId, message.message_id);
        break;
      
      case '/add_show':
        await this.startAddShow(chatId, message.message_id);
        break;
      
      case '/upload':
        await this.startUpload(chatId, message.message_id);
        break;
      
      case '/stats':
        await this.showStats(chatId);
        break;
      
      case '/manage':
        await this.showManageMenu(chatId);
        break;
      
      case '/help':
        await this.sendHelpMessage(chatId);
        break;
      
      default:
        await this.sendMessage(chatId, `❓ Unknown command: ${command}\nUse /help to see available commands.`);
    }
  }

  /**
   * Handle callback queries from inline keyboards
   * @param {Object} callbackQuery - Telegram callback query object
   */
  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    // Admin check
    if (!this.isAdmin(chatId, userId)) {
      await this.answerCallbackQuery(callbackQuery.id, '🚫 Access denied');
      return;
    }

    try {
      const [action, ...params] = data.split(':');

      switch (action) {
        case 'add_movie':
          await this.handleMovieAction(chatId, messageId, params, callbackQuery.id);
          break;
        
        case 'add_show':
          await this.handleShowAction(chatId, messageId, params, callbackQuery.id);
          break;
        
        case 'upload':
          await this.handleUploadAction(chatId, messageId, params, callbackQuery.id);
          break;
        
        case 'manage':
          await this.handleManageAction(chatId, messageId, params, callbackQuery.id);
          break;
        
        case 'bulk':
          await this.handleBulkAction(chatId, messageId, params, callbackQuery.id);
          break;
        
        case 'cancel':
          await this.cancelOperation(chatId, messageId, callbackQuery.id);
          break;
        
        default:
          await this.answerCallbackQuery(callbackQuery.id, '❓ Unknown action');
      }
    } catch (error) {
      console.error('Callback query error:', error);
      await this.answerCallbackQuery(callbackQuery.id, '❌ Error processing request');
    }
  }

  /**
   * Send welcome message with main menu
   * @param {string} chatId - Chat ID
   */
  async sendWelcomeMessage(chatId) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎬 Add Movie', callback_data: 'add_movie:start' },
          { text: '📺 Add TV Show', callback_data: 'add_show:start' }
        ],
        [
          { text: '📤 Upload Content', callback_data: 'upload:start' },
          { text: '📊 View Stats', callback_data: 'stats:show' }
        ],
        [
          { text: '⚙️ Manage Content', callback_data: 'manage:menu' },
          { text: '🔄 Bulk Operations', callback_data: 'bulk:menu' }
        ],
        [
          { text: '❓ Help', callback_data: 'help:show' }
        ]
      ]
    };

    const message = `🎬 **SparrowFlix Admin Panel**\n\n` +
                   `Welcome to the streamlined admin interface!\n\n` +
                   `**Available Operations:**\n` +
                   `• Add movies and TV shows to the platform\n` +
                   `• Upload and manage content files\n` +
                   `• View platform statistics and analytics\n` +
                   `• Perform bulk content operations\n\n` +
                   `Select an option below to continue:`;

    await this.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  /**
   * Start add movie workflow
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID
   */
  async startAddMovie(chatId, messageId) {
    const operationId = `movie_${Date.now()}`;
    this.activeOperations.set(operationId, {
      type: 'add_movie',
      chatId,
      startTime: Date.now(),
      data: {}
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎬 Single Movie', callback_data: `add_movie:single:${operationId}` },
          { text: '📂 Bulk Import', callback_data: `add_movie:bulk:${operationId}` }
        ],
        [
          { text: '🔍 Search TMDB', callback_data: `add_movie:search:${operationId}` }
        ],
        [
          { text: '❌ Cancel', callback_data: 'cancel:operation' }
        ]
      ]
    };

    const message = `🎬 **Add Movie**\n\n` +
                   `Choose how you want to add movies:\n\n` +
                   `• **Single Movie**: Add one movie with full details\n` +
                   `• **Bulk Import**: Import multiple movies from a list\n` +
                   `• **Search TMDB**: Find and import from TMDB database\n\n` +
                   `⏱️ This operation will timeout in 5 minutes.`;

    await this.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  /**
   * Start add TV show workflow
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID
   */
  async startAddShow(chatId, messageId) {
    const operationId = `show_${Date.now()}`;
    this.activeOperations.set(operationId, {
      type: 'add_show',
      chatId,
      startTime: Date.now(),
      data: {}
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📺 Single Show', callback_data: `add_show:single:${operationId}` },
          { text: '📂 Bulk Import', callback_data: `add_show:bulk:${operationId}` }
        ],
        [
          { text: '🔍 Search TMDB', callback_data: `add_show:search:${operationId}` }
        ],
        [
          { text: '❌ Cancel', callback_data: 'cancel:operation' }
        ]
      ]
    };

    const message = `📺 **Add TV Show**\n\n` +
                   `Choose how you want to add TV shows:\n\n` +
                   `• **Single Show**: Add one show with episodes\n` +
                   `• **Bulk Import**: Import multiple shows from a list\n` +
                   `• **Search TMDB**: Find and import from TMDB database\n\n` +
                   `⏱️ This operation will timeout in 5 minutes.`;

    await this.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  /**
   * Start upload workflow
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID
   */
  async startUpload(chatId, messageId) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📁 Upload Video File', callback_data: 'upload:video' },
          { text: '🖼️ Upload Images', callback_data: 'upload:images' }
        ],
        [
          { text: '📄 Upload Subtitles', callback_data: 'upload:subtitles' },
          { text: '📋 Upload Metadata', callback_data: 'upload:metadata' }
        ],
        [
          { text: '❌ Cancel', callback_data: 'cancel:operation' }
        ]
      ]
    };

    const message = `📤 **Upload Content**\n\n` +
                   `Select what type of content you want to upload:\n\n` +
                   `• **Video File**: Upload movie/episode files (max 2GB)\n` +
                   `• **Images**: Upload posters, backdrops, thumbnails\n` +
                   `• **Subtitles**: Upload subtitle files (.srt, .vtt)\n` +
                   `• **Metadata**: Upload content information (JSON/CSV)\n\n` +
                   `⚠️ **File Size Limit**: 2GB per file (Telegram limit)`;

    await this.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  /**
   * Show platform statistics
   * @param {string} chatId - Chat ID
   */
  async showStats(chatId) {
    try {
      const stats = await this.db.getStats();
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Detailed Stats', callback_data: 'stats:detailed' },
            { text: '📈 Usage Analytics', callback_data: 'stats:usage' }
          ],
          [
            { text: '🔄 Refresh', callback_data: 'stats:refresh' },
            { text: '📄 Export Report', callback_data: 'stats:export' }
          ]
        ]
      };

      const message = `📊 **Platform Statistics**\n\n` +
                     `🎬 **Movies**: ${stats.movieCount || 0}\n` +
                     `📺 **TV Shows**: ${stats.showCount || 0}\n` +
                     `📹 **Episodes**: ${stats.episodeCount || 0}\n` +
                     `👥 **Users**: ${stats.userCount || 0}\n\n` +
                     `💾 **Storage Used**: ${this.formatBytes(stats.totalSize || 0)}\n` +
                     `📡 **CDN Migration**: ${stats.cdnMigrated || 0}/${stats.totalContent || 0}\n\n` +
                     `📅 **Last Updated**: ${new Date().toLocaleString()}`;

      await this.sendMessage(chatId, message, { reply_markup: keyboard });
    } catch (error) {
      await this.sendMessage(chatId, `❌ Error fetching stats: ${error.message}`);
    }
  }

  /**
   * Show management menu
   * @param {string} chatId - Chat ID
   */
  async showManageMenu(chatId) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎬 Manage Movies', callback_data: 'manage:movies' },
          { text: '📺 Manage Shows', callback_data: 'manage:shows' }
        ],
        [
          { text: '👥 Manage Users', callback_data: 'manage:users' },
          { text: '🔧 System Settings', callback_data: 'manage:system' }
        ],
        [
          { text: '🔄 CDN Migration', callback_data: 'manage:migration' },
          { text: '🧹 Cleanup Tools', callback_data: 'manage:cleanup' }
        ],
        [
          { text: '🔍 Search Content', callback_data: 'manage:search' }
        ]
      ]
    };

    const message = `⚙️ **Content Management**\n\n` +
                   `Select what you want to manage:\n\n` +
                   `• **Movies/Shows**: Edit, delete, or update content\n` +
                   `• **Users**: Manage user accounts and permissions\n` +
                   `• **CDN Migration**: Monitor and control content migration\n` +
                   `• **Cleanup**: Remove orphaned files and data\n` +
                   `• **Search**: Find specific content quickly`;

    await this.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  /**
   * Send help message
   * @param {string} chatId - Chat ID
   */
  async sendHelpMessage(chatId) {
    const message = `❓ **SparrowFlix Admin Bot Help**\n\n` +
                   `**Available Commands:**\n` +
                   `/start - Show main menu\n` +
                   `/add_movie - Add new movies\n` +
                   `/add_show - Add new TV shows\n` +
                   `/upload - Upload content files\n` +
                   `/stats - View platform statistics\n` +
                   `/manage - Content management tools\n` +
                   `/help - Show this help message\n\n` +
                   `**Features:**\n` +
                   `• ⚡ Streamlined interface with inline keyboards\n` +
                   `• 🔄 Bulk operations for efficient management\n` +
                   `• 🔒 Admin-only access control\n` +
                   `• ⏱️ Automatic command timeouts (5 minutes)\n` +
                   `• 📊 Real-time statistics and monitoring\n\n` +
                   `**File Upload Limits:**\n` +
                   `• Videos: 2GB maximum (Telegram limit)\n` +
                   `• Images: 10MB maximum\n` +
                   `• Subtitles: 50MB maximum\n\n` +
                   `For technical support, contact the system administrator.`;

    await this.sendMessage(chatId, message);
  }

  /**
   * Handle file uploads
   * @param {Object} message - Telegram message with file
   */
  async handleFileUpload(message) {
    const chatId = message.chat.id;
    const file = message.document || message.video;
    
    if (!file) return;

    // Check file size
    if (file.file_size > this.maxFileSize) {
      await this.sendMessage(chatId, 
        `❌ **File too large!**\n\n` +
        `Size: ${this.formatBytes(file.file_size)}\n` +
        `Maximum: ${this.formatBytes(this.maxFileSize)}\n\n` +
        `Please compress the file or use a different upload method.`
      );
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎬 Movie File', callback_data: `upload:process:movie:${file.file_id}` },
          { text: '📺 Episode File', callback_data: `upload:process:episode:${file.file_id}` }
        ],
        [
          { text: '🖼️ Image/Poster', callback_data: `upload:process:image:${file.file_id}` },
          { text: '📄 Subtitle File', callback_data: `upload:process:subtitle:${file.file_id}` }
        ],
        [
          { text: '❌ Cancel', callback_data: 'cancel:upload' }
        ]
      ]
    };

    const responseMessage = `📁 **File Received**\n\n` +
                           `**Name**: ${file.file_name || 'Unknown'}\n` +
                           `**Size**: ${this.formatBytes(file.file_size)}\n` +
                           `**Type**: ${file.mime_type || 'Unknown'}\n\n` +
                           `What type of content is this file?`;

    await this.sendMessage(chatId, responseMessage, { reply_markup: keyboard });
  }

  /**
   * Handle movie-related callback actions
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID
   * @param {Array} params - Action parameters
   * @param {string} callbackQueryId - Callback query ID
   */
  async handleMovieAction(chatId, messageId, params, callbackQueryId) {
    const [subAction, operationId] = params;

    switch (subAction) {
      case 'single':
        await this.startSingleMovieAdd(chatId, messageId, operationId);
        break;
      case 'bulk':
        await this.startBulkMovieAdd(chatId, messageId, operationId);
        break;
      case 'search':
        await this.startMovieSearch(chatId, messageId, operationId);
        break;
    }

    await this.answerCallbackQuery(callbackQueryId, '✅ Operation started');
  }

  /**
   * Start single movie addition
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID
   * @param {string} operationId - Operation ID
   */
  async startSingleMovieAdd(chatId, messageId, operationId) {
    const message = `🎬 **Add Single Movie**\n\n` +
                   `Please send the movie information in this format:\n\n` +
                   `**Title**: Movie Name\n` +
                   `**Year**: 2023\n` +
                   `**Genre**: Action, Drama\n` +
                   `**IMDB ID**: tt1234567 (optional)\n` +
                   `**Description**: Movie plot summary...\n\n` +
                   `Or send a JSON file with movie metadata.\n\n` +
                   `⏱️ Timeout: 5 minutes`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '❌ Cancel', callback_data: 'cancel:operation' }]
      ]
    };

    await this.editMessage(chatId, messageId, message, { reply_markup: keyboard });
  }

  /**
   * Check if user is admin
   * @param {string} chatId - Chat ID
   * @param {string} userId - User ID
   */
  isAdmin(chatId, userId) {
    // Allow if no admin restrictions set or if user is in admin list
    return this.adminChatIds.length === 0 || 
           this.adminChatIds.includes(chatId.toString()) ||
           this.adminChatIds.includes(userId.toString());
  }

  /**
   * Clean up expired operations
   */
  cleanupExpiredOperations() {
    const now = Date.now();
    for (const [operationId, operation] of this.activeOperations.entries()) {
      if (now - operation.startTime > this.commandTimeout) {
        this.activeOperations.delete(operationId);
      }
    }
  }

  /**
   * Cancel active operation
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID
   * @param {string} callbackQueryId - Callback query ID
   */
  async cancelOperation(chatId, messageId, callbackQueryId) {
    await this.editMessage(chatId, messageId, 
      '❌ **Operation Cancelled**\n\nUse /start to return to the main menu.'
    );
    await this.answerCallbackQuery(callbackQueryId, 'Operation cancelled');
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes
   * @param {number} decimals - Decimal places
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Log error to database
   * @param {string} operation - Operation name
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  async logError(operation, error, context = {}) {
    try {
      await this.db.prepare(`
        INSERT INTO bot_error_log (operation, error_message, stack_trace, context, timestamp)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        operation,
        error.message,
        error.stack,
        JSON.stringify(context)
      ).run();
    } catch (logError) {
      console.error('Failed to log error to database:', logError);
    }
  }

  // Telegram API methods
  async sendMessage(chatId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options
    };

    const response = await fetch(`${this.apiUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  }

  async editMessage(chatId, messageId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'Markdown',
      ...options
    };

    const response = await fetch(`${this.apiUrl}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  }

  async answerCallbackQuery(callbackQueryId, text = '') {
    const payload = {
      callback_query_id: callbackQueryId,
      text: text
    };

    const response = await fetch(`${this.apiUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  }
}