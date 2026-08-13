import { useCallback, useEffect, useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import { MapProvider } from './context/MapContext'
import { PoiProvider } from './context/PoiContext'

const INITIAL_FEATURES = {
  filter: true,
  proximity: false,
  regions: false,
  hotels: false,
  restaurants: false,
  coffee: false,
  landmarks: false,
  allpois: false,
  saved: false,
  stats: false,
}

const TAB_PRESETS = {
  filter: { filter: true },
  proximity: { proximity: true },
  regions: { regions: true },
  hotels: { hotels: true },
  restaurants: { restaurants: true },
  coffee: { coffee: true },
  landmarks: { landmarks: true },
  allpois: { allpois: true },
  saved: { saved: true },
  stats: { stats: true },
}

function featuresFromTab(tab) {
  if (!tab || !TAB_PRESETS[tab]) return INITIAL_FEATURES
  return Object.keys(INITIAL_FEATURES).reduce((acc, key) => {
    acc[key] = key === tab
    return acc
  }, {})
}

function Dashboard() {
  const [activeFeatures, setActiveFeatures] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    return featuresFromTab(tab)
  })

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab && TAB_PRESETS[tab]) {
      setActiveFeatures(featuresFromTab(tab))
    }
  }, [])

  const onToggleFeature = useCallback((id) => {
    setActiveFeatures((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  return (
    <>
      <Header />
      <div className="container">
        <Sidebar
          activeFeatures={activeFeatures}
          onToggleFeature={onToggleFeature}
        />
        <MapView />
      </div>
    </>
  )
}

export default function App() {
  return (
    <MapProvider>
      <PoiProvider>
        <Dashboard />
      </PoiProvider>
    </MapProvider>
  )
}
