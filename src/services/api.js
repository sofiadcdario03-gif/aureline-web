import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem('ah-session-v2') || 'null');
  } catch {
    localStorage.removeItem('ah-session-v2');
  }
  if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  return config;
});

// Warm up the serverless function on app load to reduce cold start delays.
// The request is fire-and-forget; errors are silently ignored.
api.get('/health').catch(() => {});

export default api;
