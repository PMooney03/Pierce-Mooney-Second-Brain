const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalized}`
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), options)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `API ${response.status}: ${path}${text ? ` — ${text.slice(0, 200)}` : ''}`,
    )
  }
  return response.json()
}
