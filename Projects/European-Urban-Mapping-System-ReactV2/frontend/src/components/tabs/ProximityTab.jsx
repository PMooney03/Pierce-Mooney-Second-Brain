import { useCallback, useEffect, useState } from 'react'
import { fetchNearbyCities } from '../../api/proximity'
import { useMap } from '../../context/MapContext'
import { usePoi } from '../../context/PoiContext'
import { useGeolocation } from '../../hooks/useGeolocation'
import {
  buildCityListItems,
  buildProximityDisplay,
} from '../../utils/proximityFilters'
import ResultList from '../ResultList'

const QUICK_CATS = [
  { id: 'all', label: 'All' },
  { id: 'hotels', label: '🏨 Hotels' },
  { id: 'food', label: '🍽️ Food' },
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'pubs', label: '🍺 Pubs' },
  { id: 'attractions', label: '🎯 Attractions' },
  { id: 'shops', label: '🛍️ Shops' },
  { id: 'transport', label: '🚉 Transport' },
  { id: 'healthcare', label: '🏥 Healthcare' },
]

const DEFAULT_FILTERS = {
  cities: true,
  hotels: true,
  tourism: true,
  restaurants: true,
  shops: true,
  coffee: true,
  petrol: true,
  healthcare: true,
}

export default function ProximityTab({ setStatus }) {
  const {
    mapClickMode,
    toggleMapClickMode,
    setSearchLocation,
    showProximitySearch,
    applyProximityCityVisibility,
    focusMarker,
    getProximityCityMarker,
    getProximityPoiMarker,
    clearProximityLayers,
    subscribeMapClick,
  } = useMap()
  const { fetchPoiData, poiFeatures } = usePoi()
  const { locating, useMyLocation } = useGeolocation()

  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState(5)
  const [loading, setLoading] = useState(false)
  const [quickFilter, setQuickFilter] = useState('all')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [showResults, setShowResults] = useState(false)
  const [cityItems, setCityItems] = useState([])
  const [hotelItems, setHotelItems] = useState([])
  const [otherGroups, setOtherGroups] = useState([])
  const [poiCounts, setPoiCounts] = useState({ hotels: 0, pois: 0 })

  useEffect(() => {
    return subscribeMapClick(({ lat: clickLat, lng: clickLng }) => {
      setLat(clickLat.toFixed(4))
      setLng(clickLng.toFixed(4))
    })
  }, [subscribeMapClick])

  const applyDisplay = useCallback(
    (features, activeQuickFilter, filterState) => {
      const display = buildProximityDisplay(features, {
        filters: filterState,
        activeQuickFilter: activeQuickFilter,
      })
      const showCities =
        activeQuickFilter === 'all' ? filterState.cities : false
      applyProximityCityVisibility(showCities)
      setHotelItems(display.hotelItems)
      setOtherGroups(display.otherGroups)
      setPoiCounts({
        hotels: display.hotelPOICount,
        pois: display.nonHotelPoiCount,
      })
      return display.markers
    },
    [applyProximityCityVisibility],
  )

  const searchAt = useCallback(
    async (latNum, lngNum) => {
      setLoading(true)
      setStatus({ type: 'info', message: 'Loading nearby places…' })
      try {
        const [cityData, poiResult] = await Promise.all([
          fetchNearbyCities(latNum, lngNum, radius),
          fetchPoiData(latNum, lngNum, radius, true),
        ])
        const poiData = poiResult.features || []
        const cities = buildCityListItems(cityData)
        setCityItems(cities)
        const poiMarkers = applyDisplay(poiData, quickFilter, filters)
        showProximitySearch(latNum, lngNum, radius, cityData, poiMarkers, {
          showCities: quickFilter === 'all' ? filters.cities : false,
        })
        setShowResults(true)
        setStatus({
          type: 'success',
          message: `Found ${cities.length} cities and ${poiData.length} places`,
        })
      } catch (err) {
        setStatus({ type: 'error', message: err.message || 'Search failed' })
      } finally {
        setLoading(false)
      }
    },
    [
      radius,
      quickFilter,
      filters,
      fetchPoiData,
      applyDisplay,
      showProximitySearch,
      setStatus,
    ],
  )

  const runSearch = useCallback(async () => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setStatus({
        type: 'warning',
        message:
          'Please set a location — click "Click Map to Set Location" or enter coordinates',
      })
      return
    }
    await searchAt(latNum, lngNum)
  }, [lat, lng, searchAt, setStatus])

  const onLocated = useCallback(
    (loc) => {
      setLat(loc.lat.toFixed(4))
      setLng(loc.lng.toFixed(4))
      setSearchLocation(loc.lat, loc.lng, {
        popup: loc.approximate
          ? `📍 Approximate${loc.label ? `: ${loc.label}` : ''}`
          : `📍 ${loc.label || 'Your location'}`,
        panZoom: loc.approximate ? 12 : 14,
      })
      searchAt(loc.lat, loc.lng)
    },
    [setSearchLocation, searchAt],
  )

  const toggleFilter = (key) => {
    const next = { ...filters, [key]: !filters[key] }
    setFilters(next)
    if (poiFeatures.length) {
      const poiMarkers = applyDisplay(poiFeatures, quickFilter, next)
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)
      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
        showProximitySearch(
          latNum,
          lngNum,
          radius,
          { features: [] },
          poiMarkers,
          { showCities: quickFilter === 'all' ? next.cities : false },
        )
        applyProximityCityVisibility(quickFilter === 'all' ? next.cities : false)
      }
    }
  }

  return (
    <div className="controls">
      <h3>📍 Proximity Search</h3>
      <p className="info-text">
        Find everything nearby: cities, hotels, shops, restaurants, and more
        within a radius
      </p>

      <div
        style={{
          background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '2px solid #90caf9',
        }}
      >
        <h4
          style={{
            color: '#1565c0',
            fontSize: '0.9rem',
            marginBottom: '0.75rem',
            fontWeight: 600,
          }}
        >
          📍 Select Location
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem' }}>Latitude:</label>
            <input
              type="number"
              step="0.0001"
              placeholder="Click map"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem' }}>Longitude:</label>
            <input
              type="number"
              step="0.0001"
              placeholder="Click map"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            />
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{
            width: '100%',
            marginTop: 0,
            background: mapClickMode ? '#e74c3c' : undefined,
          }}
          onClick={toggleMapClickMode}
        >
          {mapClickMode
            ? '❌ Disable Map Click Mode'
            : '📍 Click Map to Set Location'}
        </button>
        {mapClickMode && (
          <p
            className="info-text"
            style={{
              color: '#e74c3c',
              fontWeight: 'bold',
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: 'white',
              borderRadius: '4px',
            }}
          >
            ✨ Map click mode ACTIVE - Click anywhere on the map!
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', marginTop: '0.5rem' }}
          disabled={locating}
          onClick={() => useMyLocation(onLocated, setStatus)}
        >
          {locating ? '📍 Locating…' : '📍 Use My Location'}
        </button>
        <p className="info-text" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
          On your phone, use <strong>https://</strong> and allow location for GPS.
        </p>
      </div>

      <div className="form-group">
        <label>Search Radius (km):</label>
        <input
          type="range"
          min="0.5"
          max="50"
          step="0.5"
          value={radius}
          onChange={(e) => setRadius(parseFloat(e.target.value))}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>0.5 km</span>
          <span style={{ fontWeight: 600, color: '#667eea', fontSize: '1rem' }}>
            {radius} km
          </span>
          <span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>50 km</span>
        </div>
        <input
          type="number"
          value={radius}
          min="0.5"
          max="50"
          step="0.5"
          onChange={(e) => setRadius(parseFloat(e.target.value) || 5)}
          style={{ marginTop: '0.5rem' }}
        />
      </div>

      <button
        type="button"
        style={{ marginTop: '1rem' }}
        disabled={loading}
        onClick={runSearch}
      >
        🔍 Search Everything Nearby
      </button>

      <div className="quick-categories">
        <h4>Quick filters</h4>
        <div className="quick-cat-grid">
          {QUICK_CATS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`quick-cat-btn${quickFilter === cat.id ? ' active' : ''}`}
              onClick={() => {
                setQuickFilter(cat.id)
                if (poiFeatures.length) {
                  const next = cat.id
                  const poiMarkers = applyDisplay(poiFeatures, next, filters)
                  const latNum = parseFloat(lat)
                  const lngNum = parseFloat(lng)
                  if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
                    showProximitySearch(
                      latNum,
                      lngNum,
                      radius,
                      { features: [] },
                      poiMarkers,
                      { showCities: next === 'all' ? filters.cities : false },
                    )
                  }
                }
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: '1.25rem',
          padding: '1.25rem',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <h4 style={{ color: '#2c3e50', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
          Advanced Filters
        </h4>
        <div className="filter-group">
          {[
            ['cities', '🏙️ Cities'],
            ['hotels', '🏨 Hotels'],
            ['tourism', '🎯 Tourism & Activities'],
            ['restaurants', '🍽️ Restaurants'],
            ['shops', '🛍️ Shops'],
            ['coffee', '☕ Cafés, Pubs & Bars'],
            ['petrol', '⛽ Petrol Stations'],
            ['healthcare', '🏥 Hospitals & Chemists'],
          ].map(([key, label]) => (
            <div key={key} className="filter-checkbox">
              <input
                type="checkbox"
                id={`filter-${key}`}
                checked={filters[key]}
                onChange={() => toggleFilter(key)}
              />
              <label htmlFor={`filter-${key}`}>{label}</label>
            </div>
          ))}
        </div>
      </div>

      {showResults && (
        <div style={{ marginTop: '1.5rem' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
              padding: '1.25rem',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            <h4 style={{ color: '#2c3e50', marginBottom: '0.75rem' }}>
              🏙️ Cities ({cityItems.length})
            </h4>
            <div
              style={{
                maxHeight: 150,
                overflowY: 'auto',
                border: '2px solid #e0e0e0',
                borderRadius: 8,
                padding: '0.75rem',
                background: 'white',
              }}
            >
              <ResultList
                items={cityItems}
                emptyMessage="No cities found in this radius"
                onSelect={(item) =>
                  focusMarker(
                    item.lat,
                    item.lng,
                    getProximityCityMarker(item.markerIndex),
                  )
                }
              />
            </div>

            <h4 style={{ color: '#2c3e50', marginTop: '1.25rem' }}>
              🏨 Hotels ({poiCounts.hotels})
            </h4>
            <div
              style={{
                maxHeight: 150,
                overflowY: 'auto',
                border: '2px solid #e0e0e0',
                borderRadius: 8,
                padding: '0.75rem',
                background: 'white',
              }}
            >
              <ResultList
                items={hotelItems}
                emptyMessage="No hotels found in this radius"
                onSelect={(item) =>
                  focusMarker(
                    item.lat,
                    item.lng,
                    getProximityPoiMarker(item.markerIndex),
                  )
                }
              />
            </div>

            <h4 style={{ color: '#2c3e50', marginTop: '1.25rem' }}>
              📍 Points of Interest ({poiCounts.pois})
            </h4>
            <div
              style={{
                maxHeight: 250,
                overflowY: 'auto',
                border: '2px solid #e0e0e0',
                borderRadius: 8,
                padding: '0.75rem',
                background: 'white',
              }}
            >
              {otherGroups.length === 0 ? (
                <p style={{ color: '#999', fontSize: '0.85rem' }}>
                  No POIs match the selected filters
                </p>
              ) : (
                otherGroups.map((group) => (
                  <div key={group.type} style={{ marginBottom: '0.75rem' }}>
                    <strong
                      style={{
                        color: '#2c3e50',
                        textTransform: 'capitalize',
                        fontSize: '0.9rem',
                      }}
                    >
                      {group.type}
                    </strong>
                    <ResultList
                      items={group.items}
                      onSelect={(item) =>
                        focusMarker(
                          item.lat,
                          item.lng,
                          getProximityPoiMarker(item.markerIndex),
                        )
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn-danger"
        style={{ marginTop: '1rem' }}
        onClick={() => {
          clearProximityLayers()
          setShowResults(false)
          setCityItems([])
          setHotelItems([])
          setOtherGroups([])
        }}
      >
        Clear proximity results
      </button>
    </div>
  )
}
