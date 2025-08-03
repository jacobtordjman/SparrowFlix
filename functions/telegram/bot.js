// functions/telegram/bot.js - Enhanced with private channel support
export class Bot {
  constructor(token, env) {
    this.token = token;
    this.env = env;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
    this.db = null;
    
    // Use your private channel for storage
    this.storageChannel = env.STORAGE_CHANNEL_ID; // -1002555400542
  }

  setDB(db) {
    this.db = db;
  }

  async handleUpdate(update) {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
      console.error('Bot update error:', error);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text;

    // Handle commands
    if (text === '/start') {
      await this.sendMainMenu(chatId);
    } else if (text === '/app' || text === '/stream') {
      await this.sendMiniApp(chatId);
    } else if (text === 'Add New Title') {
      await this.handleAddTitle(chatId);
    } else if (text === 'Upload') {
      await this.handleUpload(chatId);
    } else if (text === 'Fetch') {
      await this.handleFetch(chatId);
    } else if (text === '🎬 Open Streaming App') {
      await this.sendMiniApp(chatId);
    }

    // Handle file uploads
    if (message.document || message.video) {
      await this.handleFileUpload(message);
    }
  }

  async sendMainMenu(chatId) {
    const keyboard = {
      keyboard: [
        ['Add New Title'],
        ['Upload', 'Fetch'],
        ['🎬 Open Streaming App']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    };

    const welcomeMessage = `🎬 Welcome to SparrowFlix!\n\n` +
      `📁 Private storage channel configured\n` +
      `🔒 Your content remains completely private\n\n` +
      `Choose an option:`;

    await this.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });
  }

  async sendMiniApp(chatId) {
    const keyboard = {
      inline_keyboard: [[
        {
          text: '🍿 Open SparrowFlix Streaming 🍿',
          web_app: { url: this.env.MINI_APP_URL || `https://t.me/${this.env.BOT_USERNAME}/app` }
        }
      ]]
    };

    await this.sendMessage(chatId,
      '🎬 Click below to open the streaming app:',
      { reply_markup: keyboard }
    );
  }

  async handleFileUpload(message) {
    const chatId = message.chat.id;
    const file = message.document || message.video;
    
    if (!file) return;

    try {
      // Get user's upload context from KV
      const context = await this.env.FILEPATH_CACHE.get(`upload_${chatId}`, 'json');
      
      if (!context) {
        await this.sendMessage(chatId, 
          '❌ No upload session active. Please start with "Add New Title" first.'
        );
        return;
      }

      // Create metadata caption for private channel
      const caption = this.createFileCaption(context, message.caption, file);

      // Forward to private storage channel
      const forwarded = await this.forwardMessage(
        this.storageChannel,
        chatId,
        message.message_id
      );

      if (!forwarded.ok) {
        throw new Error('Failed to forward to storage channel');
      }

      // Add caption as reply in channel for metadata
      if (caption) {
        await this.sendMessage(this.storageChannel, caption, {
          reply_to_message_id: forwarded.result.message_id
        });
      }

      // Update database based on content type
      if (context.type === 'movie') {
        await this.db.collection('movies').updateOne(
          { _id: context.content_id },
          { 
            $set: { 
              file_id: file.file_id,
              storage_channel_id: this.storageChannel,
              storage_message_id: forwarded.result.message_id,
              file_info: {
                name: file.file_name || 'video',
                size: file.file_size,
                mime_type: file.mime_type
              },
              uploaded_at: new Date()
            }
          }
        );
        
        await this.sendMessage(chatId, '✅ Movie uploaded to private storage!');
        
        // Clear context
        await this.env.FILEPATH_CACHE.delete(`upload_${chatId}`);
        
      } else if (context.type === 'tv') {
        // Extract episode number from caption
        const episodeMatch = message.caption?.match(/[Ee](\d+)/);
        if (!episodeMatch) {
          await this.sendMessage(chatId, 
            '❌ Please include episode number in caption (e.g., E01 or Episode 1)'
          );
          return;
        }

        const episodeNum = parseInt(episodeMatch[1]);
        
        // Update TV show episode
        await this.db.collection('tv_shows').updateOne(
          { 
            _id: context.content_id,
            'details.seasons.season_number': context.season
          },
          {
            $set: {
              [`details.seasons.$.episodes.${episodeNum}`]: {
                episode_number: episodeNum,
                file_id: file.file_id,
                storage_channel_id: this.storageChannel,
                storage_message_id: forwarded.result.message_id,
                file_info: {
                  name: file.file_name || `episode_${episodeNum}`,
                  size: file.file_size,
                  mime_type: file.mime_type
                },
                uploaded_at: new Date()
              }
            }
          }
        );
        
        await this.sendMessage(chatId, 
          `✅ Episode ${episodeNum} uploaded to private storage!\n\n` +
          `Send more episodes or use "Add New Title" for a different show.`
        );
      }

    } catch (error) {
      console.error('File upload error:', error);
      await this.sendMessage(chatId, 
        '❌ Upload failed. Please try again.\n' +
        'Make sure the bot has admin access to the storage channel.'
      );
    }
  }

  createFileCaption(context, userCaption, file) {
    const metadata = [
      `🎬 ${context.title}`,
      `📁 Type: ${context.type}`,
      `🆔 Content ID: ${context.content_id}`,
      context.season ? `📺 Season: ${context.season}` : '',
      `📄 File: ${file.file_name || 'video'}`,
      `💾 Size: ${this.formatFileSize(file.file_size)}`,
      userCaption ? `📝 Caption: ${userCaption}` : '',
      `⏰ Uploaded: ${new Date().toISOString()}`
    ].filter(Boolean);

    return metadata.join('\n');
  }

  formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Keep your existing Telegram API methods
  async sendMessage(chatId, text, options = {}) {
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...options
    };

    const response = await fetch(`${this.apiUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return await response.json();
  }

  async forwardMessage(toChatId, fromChatId, messageId) {
    const body = {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId
    };

    const response = await fetch(`${this.apiUrl}/forwardMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return await response.json();
  }

  async answerCallbackQuery(callbackQueryId, text = null) {
    const body = {
      callback_query_id: callbackQueryId,
      text: text
    };

    await fetch(`${this.apiUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
}