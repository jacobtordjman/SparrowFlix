// functions/telegram/bot.js
export class Bot {
  constructor(token, env) {
    this.token = token;
    this.env = env;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
    this.db = null;
  }

  setDB(db) {
    this.db = db;
  }

  async handleUpdate(update) {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
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

    await this.sendMessage(chatId, 
      '🎬 Welcome to SparrowFlix!\n\nChoose an option:',
      { reply_markup: keyboard }
    );
  }

  async sendMiniApp(chatId) {
    const keyboard = {
      inline_keyboard: [[
        {
          text: '🍿 Open SparrowFlix Streaming 🍿',
          web_app: { url: `${this.env.APP_URL}` }
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
          '❌ No upload session active. Please start with /start'
        );
        return;
      }

      // Store file info
      const fileData = {
        file_id: file.file_id,
        file_name: file.file_name || 'video',
        mime_type: file.mime_type,
        file_size: file.file_size,
        caption: message.caption || ''
      };

      // Forward to storage channel
      const forwarded = await this.forwardMessage(
        this.env.STORAGE_CHANNEL_ID,
        chatId,
        message.message_id
      );

      // Update database based on content type
      if (context.type === 'movie') {
        await this.db.collection('movies').updateOne(
          { _id: context.content_id },
          { 
            $set: { 
              file_id: file.file_id,
              channel_message_id: forwarded.message_id,
              uploaded_at: new Date()
            }
          }
        );
        
        await this.sendMessage(chatId, '✅ Movie uploaded successfully!');
        
        // Clear context
        await this.env.FILEPATH_CACHE.delete(`upload_${chatId}`);
        
      } else if (context.type === 'tv') {
        // Extract episode number from caption
        const episodeMatch = message.caption?.match(/[Ee](\d+)/);
        if (!episodeMatch) {
          await this.sendMessage(chatId, 
            '❌ Please include episode number in caption (e.g., E01)'
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
                channel_message_id: forwarded.message_id,
                uploaded_at: new Date()
              }
            }
          }
        );
        
        await this.sendMessage(chatId, 
          `✅ Episode ${episodeNum} uploaded!\n\n` +
          `Send more episodes or type /done to finish.`
        );
      }

    } catch (error) {
      console.error('File upload error:', error);
      await this.sendMessage(chatId, '❌ Upload failed. Please try again.');
    }
  }

  // Telegram API methods
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

    const result = await response.json();
    return result.result;
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