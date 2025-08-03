// functions/api/stream.js

async function getTelegramFileUrl(env, botToken, fileId) {
  try {
    const cached = await env.FILEPATH_CACHE.get(fileId);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() < data.expiresAt) {
        return data.url;
      }
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const data = await response.json();

    if (!data.ok || !data.result) {
      throw new Error('Failed to get file info');
    }

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;

    await env.FILEPATH_CACHE.put(
      fileId,
      JSON.stringify({ url: fileUrl, expiresAt: Date.now() + 60 * 60 * 1000 }),
      { expirationTtl: 3600 }
    );

    return fileUrl;
  } catch (error) {
    console.error('Error getting Telegram file URL:', error);
    return null;
  }
}

export async function handleStreamRequest(request, env) {
  const url = new URL(request.url);
  const ticketId = url.pathname.split('/').pop();

  if (!ticketId) {
    return new Response('Ticket ID required', { status: 400 });
  }

  const stored = await env.TICKETS.get(ticketId);
  if (!stored) {
    return new Response('Ticket not found', { status: 404 });
  }

  let ticket;
  try {
    ticket = JSON.parse(stored);
  } catch (e) {
    return new Response('Invalid ticket', { status: 400 });
  }

  if (Date.now() > ticket.expiresAt) {
    return new Response('Ticket expired', { status: 410 });
  }

  const fileId = ticket.fileId;
  if (!fileId) {
    return new Response('File not available', { status: 404 });
  }

  const fileUrl = await getTelegramFileUrl(env, env.BOT_TOKEN, fileId);
  if (!fileUrl) {
    return new Response('Not found', { status: 404 });
  }

  const tgResponse = await fetch(fileUrl);
  if (!tgResponse.ok || !tgResponse.body) {
    return new Response('Failed to fetch file', { status: tgResponse.status });
  }

  return new Response(tgResponse.body, {
    status: 200,
    headers: {
      'Content-Type': tgResponse.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': tgResponse.headers.get('Content-Length') || undefined,
      'Cache-Control': 'public, max-age=86400'
    }
  });
}
