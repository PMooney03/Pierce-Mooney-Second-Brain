import { apiFetch } from './client'

const COUNTRY_ALIASES = {
  america: 'United States',
  usa: 'United States',
  us: 'United States',
  'united states': 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  england: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  gb: 'United Kingdom',
}

export function buildCitiesQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.populationMin != null && params.populationMin !== '') {
    search.set('population_min', String(params.populationMin))
  }
  if (params.populationMax != null && params.populationMax !== '') {
    search.set('population_max', String(params.populationMax))
  }
  if (params.country) search.set('country', params.country)
  if (params.cityType) search.set('city_type', params.cityType)
  if (params.name) search.set('name', params.name)
  const qs = search.toString()
  return `/api/cities/${qs ? `?${qs}` : ''}`
}

export async function fetchCitiesGeoJSON(params = {}) {
  return apiFetch(buildCitiesQuery(params))
}

export function normalizeCountryQuery(query) {
  const normalized = query.toLowerCase().trim()
  return COUNTRY_ALIASES[normalized] || query
}

export async function quickSearchCities(query) {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error('Please enter a city or country name')
  }

  const country = normalizeCountryQuery(trimmed)
  let data = await fetchCitiesGeoJSON({ country })

  if (!data.features?.length) {
    data = await fetchCitiesGeoJSON({ name: trimmed })
  }

  return data
}

export function cityPopupHtml(props) {
  return `
    <strong>${props.name}</strong><br>
    ${props.country}<br>
    Population: ${props.population?.toLocaleString() || 'N/A'}<br>
    Type: ${props.city_type || 'N/A'}<br>
    GDP per capita: €${props.gdp_per_capita?.toLocaleString() || 'N/A'}
  `
}
