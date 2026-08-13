import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { cityPopupHtml } from '../api/cities'
import {
  addMarkersToCluster,
  clearMarkerCluster,
  createColoredMarker,
  createHotelMarker,
  createSearchMarkerIcon,
} from '../utils/leafletMarkers'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const MapContext = createContext(null)
const MAX_MARKERS = 200

export function MapProvider({ children }) {
  const mapRef = useRef(null)
  const cityLayerRef = useRef(null)
  const proximityCityLayerRef = useRef(null)
  const searchMarkerRef = useRef(null)
  const searchCircleRef = useRef(null)
  const poiClusterRef = useRef(null)
  const proximityCityMarkersRef = useRef([])
  const regionLayersRef = useRef([])
  const hotelMarkersRef = useRef([])
  const hotelClusterRef = useRef(null)
  const restaurantMarkersRef = useRef([])
  const restaurantClusterRef = useRef(null)
  const coffeeMarkersRef = useRef([])
  const coffeeClusterRef = useRef(null)
  const landmarkMarkersRef = useRef([])
  const landmarkClusterRef = useRef(null)
  const allPoiMarkersRef = useRef([])
  const allPoiClusterRef = useRef(null)
  const savedMarkersRef = useRef([])
  const mapClickListenersRef = useRef(new Set())

  const [mapReady, setMapReady] = useState(false)
  const [cityCount, setCityCount] = useState(0)
  const [mapClickMode, setMapClickMode] = useState(false)
  const proximityPoiMarkersRef = useRef([])
  const [proximityPoiCount, setProximityPoiCount] = useState(0)
  const [regionsVisible, setRegionsVisible] = useState(false)

  const registerMap = useCallback((map) => {
    mapRef.current = map
    cityLayerRef.current = L.layerGroup().addTo(map)
    proximityCityLayerRef.current = L.layerGroup().addTo(map)
    setMapReady(true)
  }, [])

  const getMap = useCallback(() => mapRef.current, [])

  const clearCityMarkers = useCallback(() => {
    cityLayerRef.current?.clearLayers()
    setCityCount(0)
  }, [])

  const showCityGeoJSON = useCallback((geojson, { fitBounds = false, layer = 'filter' } = {}) => {
    const target =
      layer === 'proximity' ? proximityCityLayerRef.current : cityLayerRef.current
    const map = mapRef.current
    if (!target || !map) return []

    target.clearLayers()
    const markers = []

    geojson.features?.forEach((feature) => {
      if (!feature.geometry?.coordinates) return
      const [lng, lat] = feature.geometry.coordinates
      const props = feature.properties
      const marker = L.marker([lat, lng])
      marker.bindPopup(cityPopupHtml(props))
      target.addLayer(marker)
      markers.push(marker)
    })

    if (layer === 'filter') setCityCount(markers.length)

    if (fitBounds && markers.length > 0) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.1))
    }

    return markers
  }, [])

  const setSearchLocation = useCallback(
    (lat, lng, { radiusKm, popup, openPopup = true, panZoom = 14 } = {}) => {
      const map = mapRef.current
      if (!map) return

      if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current)
      if (searchCircleRef.current) map.removeLayer(searchCircleRef.current)

      searchMarkerRef.current = L.marker([lat, lng], {
        icon: createSearchMarkerIcon(),
      }).addTo(map)
      if (popup) {
        searchMarkerRef.current.bindPopup(popup)
        if (openPopup) searchMarkerRef.current.openPopup()
      }

      if (radiusKm != null) {
        searchCircleRef.current = L.circle([lat, lng], {
          radius: radiusKm * 1000,
          color: '#3498db',
          fillColor: '#3498db',
          fillOpacity: 0.1,
        }).addTo(map)
      }

      if (panZoom) map.setView([lat, lng], panZoom)
    },
    [],
  )

  const clearProximityLayers = useCallback(() => {
    const map = mapRef.current
    proximityCityLayerRef.current?.clearLayers()
    proximityCityMarkersRef.current = []
    proximityPoiMarkersRef.current = []
    poiClusterRef.current = clearMarkerCluster(map, poiClusterRef.current)
    setProximityPoiCount(0)
  }, [])

  const showProximitySearch = useCallback(
    (lat, lng, radiusKm, cityGeoJSON, poiMarkers, { showCities = true } = {}) => {
      const map = mapRef.current
      if (!map) return

      clearProximityLayers()

      setSearchLocation(lat, lng, {
        radiusKm,
        popup: '<strong>Search Location</strong>',
      })

      const cityMarkers = []
      ;(cityGeoJSON.features || []).forEach((feature) => {
        if (!feature.geometry?.coordinates) return
        const [lngC, latC] = feature.geometry.coordinates
        const props = feature.properties
        const marker = L.marker([latC, lngC])
        marker.bindPopup(cityPopupHtml(props))
        proximityCityLayerRef.current.addLayer(marker)
        cityMarkers.push(marker)
      })
      proximityCityMarkersRef.current = cityMarkers

      if (!showCities) {
        proximityCityLayerRef.current.clearLayers()
        proximityCityMarkersRef.current = []
      }

      poiClusterRef.current = addMarkersToCluster(map, poiMarkers, null)
      proximityPoiMarkersRef.current = poiMarkers
      setProximityPoiCount(poiMarkers.length)

      if (searchCircleRef.current) {
        map.fitBounds(searchCircleRef.current.getBounds())
      }
    },
    [clearProximityLayers, setSearchLocation],
  )

  const applyProximityCityVisibility = useCallback((showCities) => {
    const map = mapRef.current
    proximityCityMarkersRef.current.forEach((marker) => {
      if (showCities) {
        if (!proximityCityLayerRef.current.hasLayer(marker)) {
          proximityCityLayerRef.current.addLayer(marker)
        }
      } else if (proximityCityLayerRef.current.hasLayer(marker)) {
        proximityCityLayerRef.current.removeLayer(marker)
      }
    })
  }, [])

  const focusMarker = useCallback((lat, lng, marker) => {
    const map = mapRef.current
    if (!map || !marker) return
    map.setView([lat, lng], 16)
    marker.openPopup()
  }, [])

  const handleMapClick = useCallback(
    (latlng) => {
      if (!mapClickMode) return null
      setMapClickMode(false)
      const map = mapRef.current
      if (map) map.getContainer().style.cursor = ''

      setSearchLocation(latlng.lat, latlng.lng, {
        popup: '📍 Search Location<br>Click "Search Everything Nearby"',
      })

      const coords = { lat: latlng.lat, lng: latlng.lng }
      mapClickListenersRef.current.forEach((fn) => fn(coords))
      return coords
    },
    [mapClickMode, setSearchLocation],
  )

  const subscribeMapClick = useCallback((listener) => {
    mapClickListenersRef.current.add(listener)
    return () => mapClickListenersRef.current.delete(listener)
  }, [])

  const toggleMapClickMode = useCallback(() => {
    const map = mapRef.current
    setMapClickMode((prev) => {
      const next = !prev
      if (map) {
        map.getContainer().style.cursor = next ? 'crosshair' : ''
      }
      return next
    })
  }, [])

  const loadRegionsGeoJSON = useCallback((geojson) => {
    const map = mapRef.current
    if (!map) return

    regionLayersRef.current.forEach((layer) => {
      if (map.hasLayer(layer)) map.removeLayer(layer)
    })
    regionLayersRef.current = []

    const regionMap = {}

    ;(geojson.features || []).forEach((feature) => {
      if (!feature.geometry) return
      const props = feature.properties
      if (props.region_code) {
        regionMap[props.region_code] = {
          id: props.id || feature.id,
          name: props.name,
          region_code: props.region_code,
        }
      }

      const polygon = L.geoJSON(feature.geometry, {
        style: {
          color: '#3498db',
          weight: 2,
          fillColor: '#3498db',
          fillOpacity: 0.2,
        },
      })

      polygon.bindPopup(
        `<strong>${props.name}</strong><br>${props.country}<br>` +
          `Population: ${props.total_population?.toLocaleString() || 'N/A'}<br>` +
          `Area: ${props.area_km2?.toLocaleString() || 'N/A'} km²`,
      )

      polygon.on('click', () => {
        window.__urbanShowRegionCities?.(props.region_code, props.name)
      })

      regionLayersRef.current.push(polygon)
    })

    return regionMap
  }, [])

  const setRegionsOnMap = useCallback((visible) => {
    const map = mapRef.current
    if (!map) return
    setRegionsVisible(visible)
    regionLayersRef.current.forEach((layer) => {
      if (visible) {
        if (!map.hasLayer(layer)) layer.addTo(map)
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    })
    if (visible && regionLayersRef.current.length) {
      map.fitBounds(
        L.featureGroup(regionLayersRef.current).getBounds().pad(0.1),
      )
    }
  }, [])

  const clearRegions = useCallback(() => {
    const map = mapRef.current
    regionLayersRef.current.forEach((layer) => {
      if (map?.hasLayer(layer)) map.removeLayer(layer)
    })
    regionLayersRef.current = []
  }, [])

  const showHotelMarkers = useCallback((features) => {
    const map = mapRef.current
    if (!map) return []

    hotelMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m)
    })
    hotelClusterRef.current = clearMarkerCluster(map, hotelClusterRef.current)

    const markers = []
    features.slice(0, MAX_MARKERS).forEach((feature) => {
      if (!feature.geometry?.coordinates) return
      const [lng, lat] = feature.geometry.coordinates
      markers.push(createHotelMarker(lat, lng, feature.properties))
    })

    hotelMarkersRef.current = markers
    hotelClusterRef.current = addMarkersToCluster(map, markers, null)
    return markers
  }, [])

  const clearHotelMarkers = useCallback(() => {
    const map = mapRef.current
    hotelMarkersRef.current = []
    hotelClusterRef.current = clearMarkerCluster(map, hotelClusterRef.current)
  }, [])

  const showRestaurantMarkers = useCallback((features) => {
    const map = mapRef.current
    if (!map) return []

    restaurantMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m)
    })
    restaurantClusterRef.current = clearMarkerCluster(
      map,
      restaurantClusterRef.current,
    )

    const markers = []
    features.slice(0, MAX_MARKERS).forEach((feature) => {
      if (!feature.geometry?.coordinates) return
      const [lng, lat] = feature.geometry.coordinates
      markers.push(createColoredMarker(lat, lng, feature.properties))
    })

    restaurantMarkersRef.current = markers
    restaurantClusterRef.current = addMarkersToCluster(map, markers, null)
    return markers
  }, [])

  const clearRestaurantMarkers = useCallback(() => {
    const map = mapRef.current
    restaurantMarkersRef.current = []
    restaurantClusterRef.current = clearMarkerCluster(
      map,
      restaurantClusterRef.current,
    )
  }, [])

  const showCoffeeMarkers = useCallback((features) => {
    const map = mapRef.current
    if (!map) return []

    coffeeMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m)
    })
    coffeeClusterRef.current = clearMarkerCluster(map, coffeeClusterRef.current)

    const markers = []
    features.slice(0, MAX_MARKERS).forEach((feature) => {
      if (!feature.geometry?.coordinates) return
      const [lng, lat] = feature.geometry.coordinates
      const props = feature.properties
      const color =
        props.type === 'shop' && props.category === 'coffee' ? 'orange' : 'yellow'
      markers.push(createColoredMarker(lat, lng, props, color))
    })

    coffeeMarkersRef.current = markers
    coffeeClusterRef.current = addMarkersToCluster(map, markers, null)
    if (markers.length > 0) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.12))
    }
    return markers
  }, [])

  const clearCoffeeMarkers = useCallback(() => {
    const map = mapRef.current
    coffeeMarkersRef.current = []
    coffeeClusterRef.current = clearMarkerCluster(map, coffeeClusterRef.current)
  }, [])

  const showLandmarkMarkers = useCallback((features) => {
    const map = mapRef.current
    if (!map) return []

    landmarkMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m)
    })
    landmarkClusterRef.current = clearMarkerCluster(
      map,
      landmarkClusterRef.current,
    )

    const markers = []
    features.slice(0, MAX_MARKERS).forEach((feature) => {
      if (!feature.geometry?.coordinates) return
      const [lng, lat] = feature.geometry.coordinates
      markers.push(createColoredMarker(lat, lng, feature.properties))
    })

    landmarkMarkersRef.current = markers
    landmarkClusterRef.current = addMarkersToCluster(map, markers, null)
    return markers
  }, [])

  const clearLandmarkMarkers = useCallback(() => {
    const map = mapRef.current
    landmarkMarkersRef.current = []
    landmarkClusterRef.current = clearMarkerCluster(
      map,
      landmarkClusterRef.current,
    )
  }, [])

  const showAllPoiMarkers = useCallback((features) => {
    const map = mapRef.current
    if (!map) return []

    allPoiMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m)
    })
    allPoiClusterRef.current = clearMarkerCluster(map, allPoiClusterRef.current)

    const markers = []
    features.slice(0, 500).forEach((feature) => {
      if (!feature.geometry?.coordinates) return
      const [lng, lat] = feature.geometry.coordinates
      const props = feature.properties
      const isHotel =
        props.type === 'tourism' &&
        ['hotel', 'hostel', 'motel'].includes(props.category)
      markers.push(
        isHotel
          ? createHotelMarker(lat, lng, props)
          : createColoredMarker(lat, lng, props),
      )
    })

    allPoiMarkersRef.current = markers
    allPoiClusterRef.current = addMarkersToCluster(map, markers, null)
    return markers
  }, [])

  const clearAllPoiMarkers = useCallback(() => {
    const map = mapRef.current
    allPoiMarkersRef.current = []
    allPoiClusterRef.current = clearMarkerCluster(map, allPoiClusterRef.current)
  }, [])

  const showSavedMarkers = useCallback((places, visible) => {
    const map = mapRef.current
    if (!map) return []

    savedMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m)
    })
    savedMarkersRef.current = []

    places.forEach((place) => {
      const marker = L.marker([place.lat, place.lng])
      marker.bindPopup(
        `<strong>${place.icon || '⭐'} ${place.name}</strong><br>${place.category || ''}`,
      )
      if (visible) marker.addTo(map)
      savedMarkersRef.current.push(marker)
    })
    return [...savedMarkersRef.current]
  }, [])

  const value = useMemo(
    () => ({
      mapReady,
      cityCount,
      mapClickMode,
      proximityPoiCount,
      regionsVisible,
      registerMap,
      getMap,
      clearCityMarkers,
      showCityGeoJSON,
      setSearchLocation,
      clearProximityLayers,
      showProximitySearch,
      applyProximityCityVisibility,
      focusMarker,
      handleMapClick,
      subscribeMapClick,
      toggleMapClickMode,
      loadRegionsGeoJSON,
      setRegionsOnMap,
      clearRegions,
      showHotelMarkers,
      clearHotelMarkers,
      showRestaurantMarkers,
      clearRestaurantMarkers,
      showCoffeeMarkers,
      clearCoffeeMarkers,
      showLandmarkMarkers,
      clearLandmarkMarkers,
      showAllPoiMarkers,
      clearAllPoiMarkers,
      showSavedMarkers,
      getProximityCityMarker: (index) =>
        proximityCityMarkersRef.current[index],
      getProximityPoiMarker: (index) => proximityPoiMarkersRef.current[index],
    }),
    [
      mapReady,
      cityCount,
      mapClickMode,
      proximityPoiCount,
      regionsVisible,
      registerMap,
      getMap,
      clearCityMarkers,
      showCityGeoJSON,
      setSearchLocation,
      clearProximityLayers,
      showProximitySearch,
      applyProximityCityVisibility,
      focusMarker,
      handleMapClick,
      subscribeMapClick,
      toggleMapClickMode,
      loadRegionsGeoJSON,
      setRegionsOnMap,
      clearRegions,
      showHotelMarkers,
      clearHotelMarkers,
      showRestaurantMarkers,
      clearRestaurantMarkers,
      showCoffeeMarkers,
      clearCoffeeMarkers,
      showLandmarkMarkers,
      clearLandmarkMarkers,
      showAllPoiMarkers,
      clearAllPoiMarkers,
      showSavedMarkers,
    ],
  )

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}

export function useMap() {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMap must be used within MapProvider')
  return ctx
}
