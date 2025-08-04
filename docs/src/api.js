export async function apiRequest(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const authData = localStorage.getItem('tg-auth');
  if (authData) headers['X-Telegram-Init-Data'] = authData;
  const token = localStorage.getItem('web-token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`https://sparrowflix-dev.sparrowflix.workers.dev/api${endpoint}`, {
    ...options,
    headers,
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json();
}

export const getContent = () => apiRequest('/content');
export const createTicket = (data) =>
  apiRequest('/ticket/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
