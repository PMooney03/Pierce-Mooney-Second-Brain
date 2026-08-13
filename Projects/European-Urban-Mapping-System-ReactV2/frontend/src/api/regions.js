import { apiFetch } from './client'

export async function fetchRegionsGeoJSON(country = '') {
  const qs = country ? `?country=${encodeURIComponent(country)}` : ''
  return apiFetch(`/api/regions/${qs}`)
}

export async function fetchCitiesInRegion(regionId) {
  return apiFetch(`/api/regions/${regionId}/cities/`)
}
