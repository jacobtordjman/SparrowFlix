import { API_BASE_URL } from './config.js';

export async function apiRequest(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const authData = localStorage.getItem('tg-auth');
  if (authData) headers['X-Telegram-Init-Data'] = authData;
  const token = localStorage.getItem('web-token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API request failed: ${response.status} ${text}`);
    }
    return response.json();
  } catch (err) {
    throw new Error(err.message || 'Network request failed');
  }
}

export const getContent = () => apiRequest('/content');
export const createTicket = (data) =>
  apiRequest('/ticket/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
