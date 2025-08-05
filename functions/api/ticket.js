// functions/api/ticket.js - uses direct D1 queries

export function generateTicketId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createTicket(env, data, dbOverride = null) {
  const db = dbOverride || env.DB;
  let fileId;

  if (data.type === 'movie') {
    const stmt = db.prepare('SELECT file_id FROM movies WHERE id = ?');
    fileId = await stmt.bind(data.contentId).first('file_id');
  } else if (data.type === 'show') {
    const stmt = db.prepare(
      'SELECT file_id FROM episodes WHERE show_id = ? AND season_number = ? AND episode_number = ?'
    );
    fileId = await stmt.bind(data.contentId, data.season, data.episode).first('file_id');
  }

  const ticketId = generateTicketId();
  const expiresAt = data.expiresAt || (Date.now() + 6 * 60 * 60 * 1000);
  const ticketData = {
    ...data,
    fileId,
    expiresAt,
    createdAt: Date.now()
  };

  const ttlSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
  await env.TICKETS.put(ticketId, JSON.stringify(ticketData), {
    expirationTtl: ttlSeconds
  });

  return {
    ticketId,
    expiresAt,
    streamUrl: `/stream/${ticketId}`
  };
}

export async function handleTicketApi(request, env, params, user) {
  const [action] = params;

  if (action === 'create' && request.method === 'POST') {
    const { contentId, type, season, episode } = await request.json();

    const { ticketId, expiresAt, streamUrl } = await createTicket(env, {
      contentId,
      type,
      season,
      episode,
      userId: user?.id || 'guest'
    });

    return {
      body: JSON.stringify({
        ticket: ticketId,
        expiresAt,
        streamUrl
      }),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  return {
    body: JSON.stringify({ error: 'Invalid request' }),
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  };
}
