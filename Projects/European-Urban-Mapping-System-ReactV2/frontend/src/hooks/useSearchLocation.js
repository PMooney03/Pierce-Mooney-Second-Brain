import { useCallback, useEffect, useState } from 'react'
import { useMap } from '../context/MapContext'
import { usePoi } from '../context/PoiContext'
import { useGeolocation } from './useGeolocation'

/**
 * Shared lat/lng state for POI tabs — works without running Proximity first.
 */
export function useSearchLocation({ setStatus, defaultRadius = 5 } = {}) {
  const {
    getMap,
    setSearchLocation,
    subscribeMapClick,
    toggleMapClickMode,
    mapClickMode,
  } = useMap()
  const { searchCoords, setSearchCoords } = usePoi()
  const { locating, useMyLocation } = useGeolocation()

  const [lat, setLat] = useState(() =>
    searchCoords.lat != null ? String(searchCoords.lat) : '',
  )
  const [lng, setLng] = useState(() =>
    searchCoords.lng != null ? String(searchCoords.lng) : '',
  )

  useEffect(() => {
    return subscribeMapClick(({ lat: clickLat, lng: clickLng }) => {
      setLat(clickLat.toFixed(4))
      setLng(clickLng.toFixed(4))
      setSearchCoords({
        lat: clickLat,
        lng: clickLng,
        radius: defaultRadius,
      })
    })
  }, [subscribeMapClick, setSearchCoords, defaultRadius])

  const pinOnMap = useCallback(
    (latNum, lngNum, label) => {
      setSearchLocation(latNum, lngNum, {
        popup: label || '📍 Search location',
        panZoom: 13,
      })
      setSearchCoords({ lat: latNum, lng: lngNum, radius: defaultRadius })
    },
    [setSearchLocation, setSearchCoords, defaultRadius],
  )

  const parseCoords = useCallback(() => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
      return { lat: latNum, lng: lngNum }
    }
    const map = getMap()
    if (map) {
      const c = map.getCenter()
      return { lat: c.lat, lng: c.lng }
    }
    return null
  }, [lat, lng, getMap])

  const requireCoords = useCallback(() => {
    const coords = parseCoords()
    if (!coords) {
      setStatus?.({
        type: 'warning',
        message:
          'Enter coordinates, click the map, use My Location, or pan the map to an area first.',
      })
      return null
    }
    if (Number.isNaN(parseFloat(lat)) || Number.isNaN(parseFloat(lng))) {
      setLat(coords.lat.toFixed(4))
      setLng(coords.lng.toFixed(4))
    }
    pinOnMap(coords.lat, coords.lng)
    return coords
  }, [parseCoords, lat, lng, pinOnMap, setStatus])

  const handleUseLocation = useCallback(() => {
    useMyLocation(
      (loc) => {
        setLat(loc.lat.toFixed(4))
        setLng(loc.lng.toFixed(4))
        pinOnMap(
          loc.lat,
          loc.lng,
          loc.approximate
            ? `📍 Approximate: ${loc.label || ''}`
            : `📍 ${loc.label || 'Your location'}`,
        )
      },
      setStatus,
    )
  }, [useMyLocation, pinOnMap, setStatus])

  return {
    lat,
    lng,
    setLat,
    setLng,
    parseCoords,
    requireCoords,
    handleUseLocation,
    mapClickMode,
    toggleMapClickMode,
    locating,
    pinOnMap,
  }
}
