import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

import {
  buildPoiDetailLines,
  getPlaceTypeLabel,
  wikipediaUrl,
} from './poiDisplay'

const SHADOW =
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
const COLOR_MARKER_BASE =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x'

export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

export function getMarkerColorForCategory(category, type) {
  const colorMap = {
    restaurant: 'red',
    pub: 'orange',
    bar: 'orange',
    cafe: 'yellow',
    fast_food: 'red',
    fuel: 'grey',
    hairdresser: 'violet',
    pharmacy: 'green',
    hospital: 'red',
    clinic: 'green',
    doctors: 'green',
    supermarket: 'blue',
    museum: 'purple',
    hotel: 'gold',
    shop: 'blue',
    tourism: 'purple',
    historic: 'purple',
    leisure: 'green',
    transport: 'grey',
    amenity: 'green',
  }
  return colorMap[category] || colorMap[type] || 'blue'
}

export function buildPoiPopupHtml(props, lat, lng) {
  let content = `<strong>${props.name || 'Unnamed place'}</strong><br>`
  content += `<span style="color:#667eea;font-weight:600">${getPlaceTypeLabel(props)}</span><br>`

  if (props.distance_km != null) {
    content += `Distance: ${props.distance_km} km<br>`
  }

  buildPoiDetailLines(props).forEach((line) => {
    content += `${line}<br>`
  })

  if (props.address) content += `Address: ${props.address}<br>`
  if (props.phone) {
    content += `Phone: <a href="tel:${props.phone}">${props.phone}</a><br>`
  }
  if (props.email) {
    content += `Email: <a href="mailto:${props.email}">${props.email}</a><br>`
  }
  if (props.website) {
    const url = props.website.startsWith('http')
      ? props.website
      : `https://${props.website}`
    content += `<a href="${url}" target="_blank" rel="noopener">Website</a><br>`
  }
  const wiki = wikipediaUrl(props.wikipedia)
  if (wiki) {
    content += `<a href="${wiki}" target="_blank" rel="noopener">Wikipedia</a><br>`
  }

  const payload = encodeURIComponent(
    JSON.stringify({
      name: props.name || 'Unnamed POI',
      lat,
      lng,
      type: props.type,
      category: props.category,
      icon: props.icon || '📍',
    }),
  )

  content += `<div class="popup-actions">`
  content += `<a href="${googleMapsUrl(lat, lng)}" target="_blank" rel="noopener" class="popup-btn popup-btn-maps">Open in Google Maps</a>`
  content += `<button type="button" class="popup-btn popup-btn-save" onclick="window.saveUrbanPlace && window.saveUrbanPlace('${payload}')">⭐ Save</button>`
  content += `</div>`
  return content
}

export function createSearchMarkerIcon() {
  return L.icon({
    iconUrl: `${COLOR_MARKER_BASE}-red.png`,
    shadowUrl: SHADOW,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
}

export function createColoredMarker(lat, lng, props, forceColor) {
  const markerColor =
    forceColor || getMarkerColorForCategory(props.category, props.type)
  const icon = L.icon({
    iconUrl: `${COLOR_MARKER_BASE}-${markerColor}.png`,
    shadowUrl: SHADOW,
    iconSize: [20, 34],
    iconAnchor: [10, 34],
    popupAnchor: [1, -30],
    shadowSize: [34, 34],
  })
  const marker = L.marker([lat, lng], { icon })
  marker.bindPopup(buildPoiPopupHtml(props, lat, lng))
  return marker
}

export function createHotelMarker(lat, lng, props) {
  const icon = L.icon({
    iconUrl: `${COLOR_MARKER_BASE}-gold.png`,
    shadowUrl: SHADOW,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
  const marker = L.marker([lat, lng], { icon })
  marker.bindPopup(buildPoiPopupHtml(props, lat, lng))
  return marker
}

export function addMarkersToCluster(map, markers, existingCluster) {
  if (!markers.length) return null
  const cluster =
    existingCluster ||
    L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 200,
      chunkDelay: 50,
      maxClusterRadius: 60,
    })
  cluster.clearLayers()
  markers.forEach((m) => cluster.addLayer(m))
  map.addLayer(cluster)
  return cluster
}

export function clearMarkerCluster(map, clusterRef) {
  if (clusterRef && map.hasLayer(clusterRef)) {
    map.removeLayer(clusterRef)
  }
  return null
}
