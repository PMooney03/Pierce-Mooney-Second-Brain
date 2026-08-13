import { apiFetch } from './client'

export async function fetchNearbyDbHotels(lat, lng, radiusKm, filters = {}) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusKm),
  })
  if (filters.star_rating) params.set('star_rating', filters.star_rating)
  if (filters.price_range) params.set('price_range', filters.price_range)
  return apiFetch(`/api/hotels/nearby/?${params}`)
}
