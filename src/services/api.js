import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
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

export default api;
