// functions/api/ticket.js

export function generateTicketId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createTicket(env, data) {
  const ticketId = generateTicketId();
  const expiresAt = data.expiresAt || (Date.now() + 6 * 60 * 60 * 1000);
  const ticketData = {
    ...data,
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
