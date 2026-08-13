import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { fetchNearbyPois } from '../api/overpass'
import { categorizeFeatures } from '../utils/poiClassification'

const PoiContext = createContext(null)

export function PoiProvider({ children }) {
  const [poiFeatures, setPoiFeatures] = useState([])
  const [categorizedPois, setCategorizedPois] = useState(
    categorizeFeatures([]),
  )
  const [searchCoords, setSearchCoords] = useState({
    lat: null,
    lng: null,
    radius: 5,
  })
  const cacheRef = useRef({ lat: null, lng: null, radius: null, features: [] })

  const fetchPoiData = useCallback(async (lat, lng, radius, forceRefresh = false) => {
    const cache = cacheRef.current
    const same =
      !forceRefresh &&
      cache.lat === lat &&
      cache.lng === lng &&
      cache.radius === radius &&
      cache.features.length > 0

    if (same) {
      const categorized = categorizeFeatures(cache.features)
      return { features: cache.features, categorized }
    }

    const features = await fetchNearbyPois(lat, lng, radius)
    const categorized = categorizeFeatures(features)
    cacheRef.current = { lat, lng, radius, features }
    setPoiFeatures(features)
    setCategorizedPois(categorized)
    setSearchCoords({ lat, lng, radius })
    return { features, categorized }
  }, [])

  const clearPoiData = useCallback(() => {
    cacheRef.current = { lat: null, lng: null, radius: null, features: [] }
    setPoiFeatures([])
    setCategorizedPois(categorizeFeatures([]))
    setSearchCoords({ lat: null, lng: null, radius: 5 })
  }, [])

  const value = useMemo(
    () => ({
      poiFeatures,
      categorizedPois,
      searchCoords,
      setSearchCoords,
      fetchPoiData,
      clearPoiData,
    }),
    [poiFeatures, categorizedPois, searchCoords, fetchPoiData, clearPoiData],
  )

  return <PoiContext.Provider value={value}>{children}</PoiContext.Provider>
}

export function usePoi() {
  const ctx = useContext(PoiContext)
  if (!ctx) throw new Error('usePoi must be used within PoiProvider')
  return ctx
}
