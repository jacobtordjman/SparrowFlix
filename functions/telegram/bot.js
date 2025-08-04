// functions/telegram/bot.js - Complete bot with all handlers (FIXED)
export class Bot {
  constructor(token, env) {
    this.token = token;
    this.env = env;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
    this.db = null;
    this.storageChannel = env.STORAGE_CHANNEL_ID;
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

    console.log(`Received message: ${text} from chat: ${chatId}`);

    // Master stop command - always takes precedence
    if (text === '/stop') {
      await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);
      await this.sendMessage(chatId, 'Bot stopped. Send /start to begin again.');
      return;
    }

    // First check if user is in a state-based flow
    const handled = await this.handleStateBasedMessage(message);
    if (handled) return;

    // Handle commands and main menu options
    if (text === '/start') {
      await this.sendMainMenu(chatId);
    } else if (text === '/app' || text === '/stream') {
      await this.sendMiniApp(chatId);
    } else if (text === 'Add New Title') {
      await this.handleAddTitle(chatId);
    } else if (text === 'Upload') {
      await this.handleUpload(chatId);
    } else if (text === 'Fetch' || text === 'Fetch Movie/Episode') {
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
        ['Upload', 'Fetch Movie/Episode'],
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
          web_app: { url: 'https://jacobtordjman.github.io/SparrowFlix/' }
        }
      ]]
    };

    await this.sendMessage(chatId, '🎬 Click below to open the streaming app:', { reply_markup: keyboard });
  }

  async handleAddTitle(chatId) {
    const keyboard = {
      keyboard: [
        ['English', 'Hebrew', 'Japanese'],
        ['Back']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };

    await this.sendMessage(chatId, 'Choose a language for the title:', { reply_markup: keyboard });

    await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
      step: 'language_selection',
      action: 'add_title'
    }), { expirationTtl: 300 });
  }

  async handleUpload(chatId) {
    const keyboard = {
      keyboard: [
        ['English', 'Hebrew', 'Japanese'],
        ['Back']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };

    await this.sendMessage(chatId, '📤 Choose language for upload:', { reply_markup: keyboard });

    await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
      step: 'language_selection',
      action: 'upload'
    }), { expirationTtl: 300 });
  }

  async handleFetch(chatId) {
    const keyboard = {
      keyboard: [
        ['English', 'Hebrew', 'Japanese'],
        ['Back']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };

    await this.sendMessage(chatId, 'Choose a language to fetch titles:', { reply_markup: keyboard });

    await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
      step: 'language_selection',
      action: 'fetch'
    }), { expirationTtl: 300 });
  }

  async handleStateBasedMessage(message) {
    const chatId = message.chat.id;
    const text = message.text;

    try {
      const stateData = await this.env.FILEPATH_CACHE.get(`state_${chatId}`, 'json');
      if (!stateData) return false;

      const { step, action, ...context } = stateData;

      // Handle Back button
      if (text === 'Back') {
        await this.handleBack(chatId, step, action, context);
        return true;
      }

      switch (step) {
        case 'language_selection':
          return await this.handleLanguageSelection(chatId, text, action, context);
        case 'type_selection':
          return await this.handleTypeSelection(chatId, text, action, context);
        case 'title_search':
          return await this.handleTitleSearch(chatId, text, action, context);
        case 'title_selection':
          return await this.handleTitleSelection(chatId, text, action, context);
        case 'season_selection':
          return await this.handleSeasonSelection(chatId, text, action, context);
        default:
          return false;
      }
    } catch (error) {
      console.error('State handling error:', error);
      await this.sendMessage(chatId, 'An error occurred. Please try again.');
      await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);
      return true;
    }
  }

  async handleLanguageSelection(chatId, language, action, context) {
    if (!['English', 'Hebrew', 'Japanese'].includes(language)) {
      await this.sendMessage(chatId, 'Invalid language. Please try again.');
      return true;
    }

    const keyboard = {
      keyboard: [
        ['Movie', 'TV Show'],
        ['Back']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };

    const message = action === 'upload' 
      ? '🎬 Is it a Movie or TV Show?'
      : action === 'fetch'
      ? 'Do you want to fetch Movies or TV Shows?'
      : 'Is it a Movie or TV Show?';

    await this.sendMessage(chatId, message, { reply_markup: keyboard });

    await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
      step: 'type_selection',
      action,
      language: language.toLowerCase(),
      ...context
    }), { expirationTtl: 300 });

    return true;
  }

  async handleTypeSelection(chatId, type, action, context) {
    if (!['Movie', 'TV Show'].includes(type)) {
      await this.sendMessage(chatId, 'Invalid selection. Please choose Movie or TV Show.');
      return true;
    }

    if (action === 'fetch') {
      return await this.processFetch(chatId, context.language, type.toLowerCase());
    }

    await this.sendMessage(chatId, 
      action === 'add_title' ? 'Enter the title to search on TMDB:' : '🔍 Search for the title by name:'
    );

    await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
      step: 'title_search',
      action,
      language: context.language,
      type: type.toLowerCase(),
      ...context
    }), { expirationTtl: 300 });

    return true;
  }

  async handleTitleSearch(chatId, searchQuery, action, context) {
    try {
      if (action === 'add_title') {
        await this.searchTMDB(chatId, searchQuery, context);
      } else if (action === 'upload') {
        await this.searchDatabase(chatId, searchQuery, context);
      }
      return true;
    } catch (error) {
      console.error('Title search error:', error);
      await this.sendMessage(chatId, 'Search failed. Please try again.');
      return true;
    }
  }

  async searchTMDB(chatId, query, context) {
    try {
      await this.sendMessage(chatId, `Searching TMDB for "${query}"...\n\nFor now, I'll create a basic entry.`);

      const id = `${context.type}_${Date.now()}`;
      const title = query;

      if (context.type === 'movie') {
        await this.db.collection('movies').insertOne({
          id,
          title,
          original_title: title,
          language: context.language,
          details: JSON.stringify({
            title,
            overview: 'Added via bot',
            release_date: new Date().toISOString().split('T')[0]
          }),
          created_at: new Date().toISOString()
        });
      } else {
        await this.db.collection('tv_shows').insertOne({
          id,
          title,
          original_title: title,
          language: context.language,
          details: JSON.stringify({
            title,
            overview: 'Added via bot',
            first_air_date: new Date().toISOString().split('T')[0],
            seasons: [{ season_number: 1, episode_count: 10 }]
          }),
          created_at: new Date().toISOString()
        });
      }

      await this.sendMessage(chatId, `✅ "${title}" added successfully!`);
      await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);

    } catch (error) {
      console.error('TMDB search error:', error);
      await this.sendMessage(chatId, 'Failed to add title. Please try again.');
    }
  }

  async searchDatabase(chatId, query, context) {
    try {
      const collection = context.type === 'movie' ? 'movies' : 'tv_shows';
      const results = await this.db.collection(collection).find({
        title: { $regex: query, $options: 'i' },
        language: context.language
      }).toArray();

      if (results.length === 0) {
        await this.sendMessage(chatId, `No ${context.type}s found for "${query}" in ${context.language}.`);
        return;
      }

      const options = results.slice(0, 10).map(item => item.title);
      options.push('Back');

      const keyboard = {
        keyboard: options.map(opt => [opt]),
        resize_keyboard: true,
        one_time_keyboard: true
      };

      await this.sendMessage(chatId, `Select a ${context.type} to upload:`, { reply_markup: keyboard });

      await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
        step: 'title_selection',
        action: context.action,
        language: context.language,
        type: context.type,
        results
      }), { expirationTtl: 300 });

    } catch (error) {
      console.error('Database search error:', error);
      await this.sendMessage(chatId, 'Search failed. Please try again.');
    }
  }

  async handleTitleSelection(chatId, selectedTitle, action, context) {
    try {
      const selected = context.results.find(item => item.title === selectedTitle);
      if (!selected) {
        await this.sendMessage(chatId, 'Invalid selection. Please try again.');
        return true;
      }

      if (action === 'fetch') {
        return await this.processFetchTitle(chatId, selected, context);
      } else if (action === 'upload') {
        return await this.processUploadTitle(chatId, selected, context);
      }

      return true;
    } catch (error) {
      console.error('Title selection error:', error);
      await this.sendMessage(chatId, 'Selection failed. Please try again.');
      return true;
    }
  }

  async processFetch(chatId, language, type) {
    try {
      let results = [];

      if (type === 'movie') {
        // Movies store the file_id directly on the record
        results = await this.db.collection('movies').find({
          language: language,
          file_id: { $exists: true }
        }).toArray();
      } else {
        // TV shows store files in the episodes table – find shows that have episodes
        const [shows, episodes] = await Promise.all([
          this.db.collection('tv_shows').find({ language: language }).toArray(),
          this.db.collection('episodes').find({ file_id: { $exists: true } }).toArray()
        ]);

        const showsWithEpisodes = new Set(episodes.map(ep => ep.show_id));
        results = shows.filter(show => showsWithEpisodes.has(show.id));
      }

      if (results.length === 0) {
        await this.sendMessage(chatId, `No ${type}s found in ${language}.`);
        await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);
        return true;
      }

      const options = results.slice(0, 10).map(item => item.title);
      options.push('Back');

      const keyboard = {
        keyboard: options.map(opt => [opt]),
        resize_keyboard: true,
        one_time_keyboard: true
      };

      await this.sendMessage(chatId, `Select a ${type}:`, { reply_markup: keyboard });

      await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
        step: 'title_selection',
        action: 'fetch',
        language,
        type,
        results
      }), { expirationTtl: 300 });

      return true;
    } catch (error) {
      console.error('Fetch error:', error);
      await this.sendMessage(chatId, 'Error fetching titles. Please try again.');
      return true;
    }
  }

  async processFetchTitle(chatId, selected, context) {
    if (context.type === 'movie') {
      if (selected.file_id) {
        await this.sendMessage(chatId, `🎬 ${selected.title}`);
        await this.sendDocument(chatId, selected.file_id);
      } else {
        await this.sendMessage(chatId, 'This movie has no file uploaded yet.');
      }
    } else {
      const details = typeof selected.details === 'string'
        ? JSON.parse(selected.details)
        : (selected.details || {});
      const seasons = details.seasons || [];
      
      if (seasons.length === 0) {
        await this.sendMessage(chatId, 'No seasons found for this show.');
        return true;
      }

      const options = seasons.map(s => `Season ${s.season_number}`);
      options.push('Back');

      const keyboard = {
        keyboard: options.map(opt => [opt]),
        resize_keyboard: true,
        one_time_keyboard: true
      };

      await this.sendMessage(chatId, 'Select a season:', { reply_markup: keyboard });

      await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
        step: 'season_selection',
        action: 'fetch',
        selected_show: selected,
        ...context
      }), { expirationTtl: 300 });
    }

    return true;
  }

  async processUploadTitle(chatId, selected, context) {
    if (context.type === 'movie') {
      await this.sendMessage(chatId, `📽️ Ready to upload: *${selected.title}*\n\nPlease send the movie file.`, { parse_mode: 'Markdown' });

      await this.env.FILEPATH_CACHE.put(`upload_${chatId}`, JSON.stringify({
        content_id: selected.id,
        title: selected.title,
        type: 'movie'
      }), { expirationTtl: 1800 });

    } else {
      const details = typeof selected.details === 'string'
        ? JSON.parse(selected.details)
        : (selected.details || {});
      const seasons = details.seasons || [];
      
      if (seasons.length === 0) {
        await this.sendMessage(chatId, 'No seasons found for this show.');
        return true;
      }

      const options = seasons.map(s => `Season ${s.season_number}`);
      options.push('Back');

      const keyboard = {
        keyboard: options.map(opt => [opt]),
        resize_keyboard: true,
        one_time_keyboard: true
      };

      await this.sendMessage(chatId, 'Select season to upload:', { reply_markup: keyboard });

      await this.env.FILEPATH_CACHE.put(`state_${chatId}`, JSON.stringify({
        step: 'season_selection',
        action: 'upload',
        selected_show: selected,
        ...context
      }), { expirationTtl: 300 });
    }

    await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);
    return true;
  }

  async handleSeasonSelection(chatId, seasonText, action, context) {
    try {
      const seasonMatch = seasonText.match(/Season (\d+)/);
      if (!seasonMatch) {
        await this.sendMessage(chatId, 'Invalid season format.');
        return true;
      }

      const seasonNumber = parseInt(seasonMatch[1]);

      if (action === 'upload') {
        await this.sendMessage(chatId, `📺 *${context.selected_show.title}* - Season ${seasonNumber}\n\nUpload episodes with captions like: E01, E02, etc.`, { parse_mode: 'Markdown' });

        await this.env.FILEPATH_CACHE.put(`upload_${chatId}`, JSON.stringify({
          content_id: context.selected_show.id,
          title: context.selected_show.title,
          type: 'tv',
          season: seasonNumber
        }), { expirationTtl: 1800 });

      } else if (action === 'fetch') {
        const episodes = await this.db.collection('episodes').find({
          show_id: context.selected_show.id,
          season_number: seasonNumber,
          file_id: { $exists: true }
        }).toArray();

        if (episodes.length === 0) {
          await this.sendMessage(chatId, 'No episodes uploaded for this season.');
          return true;
        }

        const options = episodes.map(ep => `Episode ${ep.episode_number}`);
        options.push('Back');

        const keyboard = {
          keyboard: options.map(opt => [opt]),
          resize_keyboard: true,
          one_time_keyboard: true
        };

        await this.sendMessage(chatId, 'Select an episode:', { reply_markup: keyboard });
      }

      await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);
      return true;

    } catch (error) {
      console.error('Season selection error:', error);
      await this.sendMessage(chatId, 'Season selection failed. Please try again.');
      return true;
    }
  }

  async handleBack(chatId, currentStep, action, context) {
    switch (currentStep) {
      case 'language_selection':
        await this.sendMainMenu(chatId);
        await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);
        break;
      case 'type_selection':
        if (action === 'add_title') await this.handleAddTitle(chatId);
        else if (action === 'upload') await this.handleUpload(chatId);
        else if (action === 'fetch') await this.handleFetch(chatId);
        break;
      case 'title_search':
        await this.handleLanguageSelection(chatId, context.language, action, context);
        break;
      default:
        await this.sendMainMenu(chatId);
        await this.env.FILEPATH_CACHE.delete(`state_${chatId}`);
    }
  }

  async handleFileUpload(message) {
    const chatId = message.chat.id;
    const file = message.document || message.video;
    
    if (!file) return;

    try {
      const context = await this.env.FILEPATH_CACHE.get(`upload_${chatId}`, 'json');
      
      if (!context) {
        await this.sendMessage(chatId, '❌ No upload session active. Please start with "Upload" first.');
        return;
      }

      const forwarded = await this.forwardMessage(this.storageChannel, chatId, message.message_id);

      if (!forwarded.ok) {
        throw new Error('Failed to forward to storage channel');
      }

      const caption = this.createFileCaption(context, message.caption, file);
      if (caption) {
        await this.sendMessage(this.storageChannel, caption, {
          reply_to_message_id: forwarded.result.message_id
        });
      }

      if (context.type === 'movie') {
        await this.db.collection('movies').updateOne(
          { id: context.content_id },
          { 
            $set: { 
              file_id: file.file_id,
              storage_channel_id: this.storageChannel,
              storage_message_id: forwarded.result.message_id,
              file_info: JSON.stringify({
                name: file.file_name || 'video',
                size: file.file_size,
                mime_type: file.mime_type
              }),
              uploaded_at: new Date().toISOString()
            }
          }
        );
        
        await this.sendMessage(chatId, '✅ Movie uploaded to private storage!');
        await this.env.FILEPATH_CACHE.delete(`upload_${chatId}`);
        
      } else if (context.type === 'tv') {
        const episodeMatch = message.caption?.match(/[Ee](\d+)/);
        if (!episodeMatch) {
          await this.sendMessage(chatId, '❌ Please include episode number in caption (e.g., E01)');
          return;
        }

        const episodeNum = parseInt(episodeMatch[1]);
        
        await this.db.collection('episodes').updateOne(
          { 
            show_id: context.content_id,
            season_number: context.season,
            episode_number: episodeNum
          },
          {
            $set: {
              file_id: file.file_id,
              storage_channel_id: this.storageChannel,
              storage_message_id: forwarded.result.message_id,
              file_info: JSON.stringify({
                name: file.file_name || `episode_${episodeNum}`,
                size: file.file_size,
                mime_type: file.mime_type
              }),
              uploaded_at: new Date().toISOString()
            }
          },
          { upsert: true }
        );
        
        await this.sendMessage(chatId, `✅ Episode ${episodeNum} uploaded!`);
      }

    } catch (error) {
      console.error('File upload error:', error);
      await this.sendMessage(chatId, '❌ Upload failed. Please try again.');
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

  async sendDocument(chatId, fileId) {
    const body = {
      chat_id: chatId,
      document: fileId
    };

    const response = await fetch(`${this.apiUrl}/sendDocument`, {
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