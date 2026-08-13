import { apiFetch } from './client'

export async function fetchNearbyPois(lat, lng, radiusKm) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusKm),
  })
  const data = await apiFetch(`/api/overpass/all/?${params}`)
  if (data.error) throw new Error(data.error)
  return data.features || []
}
