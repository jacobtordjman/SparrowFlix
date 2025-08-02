// In the getTelegramFileUrl function, add env parameter
async function getTelegramFileUrl(env, botToken, fileId) {
  try {
    // Check cache first
    const cached = await env.FILEPATH_CACHE.get(fileId);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() < data.expiresAt) {
        return data.url;
      }
    }

    // Get file path from Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    
    const data = await response.json();
    
    if (!data.ok || !data.result) {
      throw new Error('Failed to get file info');
    }
    
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    
    // Cache for 1 hour
    await env.FILEPATH_CACHE.put(fileId, JSON.stringify({
      url: fileUrl,
      expiresAt: Date.now() + (60 * 60 * 1000)
    }), {
      expirationTtl: 3600
    });
    
    return fileUrl;
    
  } catch (error) {
    console.error('Error getting Telegram file URL:', error);
    return null;
  }
}

// Update the call to include env
const fileUrl = await getTelegramFileUrl(env, env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN, fileId);