// functions/api/stream.js
import { connectDB } from '../db/connection.js';

export async function handleStreamRequest(request, env) {
  const url = new URL(request.url);
  const ticketId = url.pathname.split('/')[2];
  
  if (!ticketId) {
    return new Response('Invalid stream request', { status: 400 });
  }

  try {
    // Validate ticket
    const ticketData = await env.TICKETS.get(ticketId, 'json');
    
    if (!ticketData) {
      return new Response('Invalid or expired ticket', { status: 403 });
    }
    
    if (Date.now() > ticketData.expiresAt) {
      await env.TICKETS.delete(ticketId);
      return new Response('Ticket expired', { status: 403 });
    }

    // Get file info from database
    const db = await connectDB(env.MONGO_URI);
    let fileId, fileName;
    
    if (ticketData.type === 'movie') {
      const movie = await db.collection('movies').findOne({ _id: ticketData.contentId });
      if (!movie || !movie.file_id) {
        return new Response('Content not found', { status: 404 });
      }
      fileId = movie.file_id;
      fileName = `${movie.title}.mp4`;
    } else {
      const show = await db.collection('tv_shows').findOne({ _id: ticketData.contentId });
      if (!show) {
        return new Response('Content not found', { status: 404 });
      }
      
      const season = show.details?.seasons?.find(s => s.season_number === ticketData.season);
      const episode = season?.episodes?.[ticketData.episode];
      
      if (!episode || !episode.file_id) {
        return new Response('Episode not found', { status: 404 });
      }
      
      fileId = episode.file_id;
      fileName = `${show.title} S${ticketData.season}E${ticketData.episode}.mp4`;
    }

    // Get file from Telegram
    const fileUrl = await getTelegramFileUrl(env.BOT_TOKEN, fileId);
    
    if (!fileUrl) {
      return new Response('Failed to get file URL', { status: 500 });
    }

    // Handle range requests for video streaming
    const range = request.headers.get('range');
    
    if (range) {
      // Fetch with range header
      const response = await fetch(fileUrl, {
        headers: { range }
      });
      
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': response.headers.get('content-range'),
          'Accept-Ranges': 'bytes',
          'Content-Length': response.headers.get('content-length'),
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Cache-Control': 'private, max-age=3600'
        }
      });
    } else {
      // Stream the entire file
      const response = await fetch(fileUrl);
      
      return new Response(response.body, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': response.headers.get('content-length'),
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600'
        }
      });
    }
    
  } catch (error) {
    console.error('Stream error:', error);
    return new Response('Streaming error', { status: 500 });
  }
}

async function getTelegramFileUrl(botToken, fileId) {
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