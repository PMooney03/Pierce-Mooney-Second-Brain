import { apiFetch } from './client'

export async function fetchNearbyCities(lat, lng, radiusKm) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    distance: String(radiusKm),
  })
  return apiFetch(`/api/cities/nearby/?${params}`)
}
