import type { RegisterResult, User } from './authTypes';
import type { FoodResult, FrequentMeal, HistoryData, Meal, MedStatus } from './types';
import type { MedSlot } from './medUtils';

const BASE = '/api';
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Something went wrong');
  }
  return res.json();
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<RegisterResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  verifyEmail: (token: string) =>
    request<{ message: string; user: User }>(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (email: string) =>
    request<RegisterResult>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string; emailSent?: boolean; devLink?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string; user: User }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  me: () => request<{ user: User }>('/auth/me'),

  getMeds: (date: string) => request<MedStatus>(`/meds/${date}`),
  toggleMed: (date: string, slot: MedSlot) =>
    request<{ slot: string; takenAt: string | null }>('/meds', {
      method: 'POST',
      body: JSON.stringify({ date, slot }),
    }),
  getMeals: (date: string) => request<Meal[]>(`/meals/${date}`),
  getFrequentMeals: () => request<FrequentMeal[]>('/meals/frequent'),
  addMeal: (meal: Omit<Meal, 'id' | 'created_at'>) =>
    request<Meal>('/meals', { method: 'POST', body: JSON.stringify(meal) }),
  updateMeal: (id: number, meal: Omit<Meal, 'id' | 'created_at'>) =>
    request<Meal>(`/meals/${id}`, { method: 'PUT', body: JSON.stringify(meal) }),
  deleteMeal: (id: number) => request<{ ok: boolean }>(`/meals/${id}`, { method: 'DELETE' }),
  getHistory: (days: number | 'all' = 90) =>
    request<HistoryData>(`/history?days=${days === 'all' ? 'all' : days}`),
  searchFood: (q: string) => request<FoodResult[]>(`/food/search?q=${encodeURIComponent(q)}`),
  lookupBarcode: (code: string) => request<FoodResult>(`/food/barcode/${code}`),
  getSetting: (key: string) => request<{ value: string | null }>(`/settings/${key}`),
  setSetting: (key: string, value: string) =>
    request<{ ok: boolean }>('/settings', { method: 'POST', body: JSON.stringify({ key, value }) }),
};

export async function fetchWeather(lat: number, lon: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather unavailable');
  const data = await res.json();
  return {
    temp: data.current.temperature_2m as number,
    code: data.current.weather_code as number,
  };
}

const WEATHER_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  95: 'Thunderstorm',
};

export function weatherLabel(code: number) {
  return WEATHER_LABELS[code] ?? 'Weather';
}
