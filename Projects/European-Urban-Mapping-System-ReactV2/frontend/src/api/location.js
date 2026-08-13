import { apiFetch } from './client'

export async function fetchApproximateLocation() {
  return apiFetch('/api/location/approximate/')
}

export async function fetchNetworkLocationIpApi() {
  const data = await fetch('https://ipapi.co/json/').then((r) => r.json())
  if (!data.latitude || !data.longitude) throw new Error('ipapi failed')
  const label = [data.city, data.region, data.country_name]
    .filter(Boolean)
    .join(', ')
  return {
    lat: data.latitude,
    lng: data.longitude,
    label,
    approximate: true,
  }
}

export async function fetchNetworkLocationIpApiCom() {
  const data = await fetch(
    'http://ip-api.com/json/?fields=status,lat,lon,city,regionName,country,message',
  ).then((r) => r.json())
  if (data.status !== 'success') throw new Error(data.message)
  const label = [data.city, data.regionName, data.country]
    .filter(Boolean)
    .join(', ')
  return { lat: data.lat, lng: data.lon, label, approximate: true }
}

export async function resolveNetworkLocation() {
  try {
    return await fetchNetworkLocationIpApi()
  } catch {
    try {
      return await fetchNetworkLocationIpApiCom()
    } catch {
      const data = await fetchApproximateLocation()
      if (data.error) throw new Error(data.error)
      const label = [data.city, data.country].filter(Boolean).join(', ')
      return {
        lat: data.lat,
        lng: data.lng,
        label,
        approximate: true,
      }
    }
  }
}

export function getGpsPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    })
  })
}
