import { useRef, useState } from 'react'
import { useMap } from '../../context/MapContext'
import { usePoi } from '../../context/PoiContext'
import { useSearchLocation } from '../../hooks/useSearchLocation'
import { buildListSubtitle } from '../../utils/poiDisplay'
import SearchLocationPanel from '../SearchLocationPanel'
import ResultList from '../ResultList'

export default function AllPoisTab({ setStatus }) {
  const { showAllPoiMarkers, clearAllPoiMarkers, focusMarker } = useMap()
  const { fetchPoiData } = usePoi()
  const [radius, setRadius] = useState(2)
  const [visible, setVisible] = useState(true)
  const [poiType, setPoiType] = useState('')
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(0)
  const [listItems, setListItems] = useState([])
  const rawFeaturesRef = useRef([])

  const {
    lat,
    lng,
    setLat,
    setLng,
    requireCoords,
    handleUseLocation,
    mapClickMode,
    toggleMapClickMode,
    locating,
  } = useSearchLocation({ setStatus, defaultRadius: radius })

  const applyFilter = (source) => {
    let features = source ?? rawFeaturesRef.current
    if (poiType) {
      features = features.filter((f) => f.properties?.type === poiType)
    }
    if (!visible) {
      clearAllPoiMarkers()
      setListItems([])
      setCount(0)
      return
    }
    const markers = showAllPoiMarkers(features)
    const items = features.slice(0, 200).map((feature, index) => {
      const [lngM, latM] = feature.geometry.coordinates
      const props = feature.properties
      return {
        name: props.name || 'POI',
        icon: props.icon || '📍',
        category: props.category,
        subtitle: buildListSubtitle(props),
        distance: props.distance_km,
        lat: latM,
        lng: lngM,
        marker: markers[index],
      }
    })
    setListItems(items)
    setCount(items.length)
  }

  const handleFetch = async () => {
    const coords = requireCoords()
    if (!coords) return

    setLoading(true)
    setStatus({ type: 'info', message: 'Fetching POIs from OpenStreetMap…' })
    try {
      const result = await fetchPoiData(
        coords.lat,
        coords.lng,
        radius,
        true,
      )
      rawFeaturesRef.current = result.features || []
      applyFilter(rawFeaturesRef.current)
      setStatus({
        type: 'success',
        message: `Loaded ${rawFeaturesRef.current.length} POIs within ${radius} km`,
      })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Fetch failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="controls">
      <h3>All Points of Interest</h3>
      <p className="info-text">
        Shops, restaurants, landmarks, and more from OpenStreetMap
      </p>

      <SearchLocationPanel
        lat={lat}
        lng={lng}
        setLat={setLat}
        setLng={setLng}
        mapClickMode={mapClickMode}
        onToggleMapClick={toggleMapClickMode}
        onUseLocation={handleUseLocation}
        locating={locating}
        compact
      />

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => {
              setVisible(e.target.checked)
              applyFilter()
            }}
          />{' '}
          Show All POIs
        </label>
      </div>
      <div className="form-group">
        <label>Search Radius (km):</label>
        <input
          type="number"
          value={radius}
          min={0.5}
          max={10}
          step={0.5}
          onChange={(e) => setRadius(parseFloat(e.target.value) || 2)}
        />
      </div>
      <div className="form-group">
        <label>Filter by Type:</label>
        <select
          value={poiType}
          onChange={(e) => {
            setPoiType(e.target.value)
            applyFilter()
          }}
        >
          <option value="">All Types</option>
          <option value="shop">🛍️ Shops</option>
          <option value="amenity">🏢 Amenities</option>
          <option value="tourism">🎯 Tourism</option>
          <option value="historic">🏛️ Historic</option>
          <option value="leisure">🌳 Leisure</option>
          <option value="transport">🚉 Transport</option>
        </select>
      </div>
      <button type="button" disabled={loading} onClick={handleFetch}>
        🔍 Fetch All POIs
      </button>
      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: '0.5rem' }}
        onClick={() => {
          clearAllPoiMarkers()
          rawFeaturesRef.current = []
          setListItems([])
          setCount(0)
        }}
      >
        Clear All POIs
      </button>
      <div className="stat-item" style={{ marginTop: '1rem' }}>
        <strong>POIs Shown:</strong> <span>{count}</span>
      </div>
      {listItems.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            maxHeight: 300,
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '0.5rem',
            background: '#f9f9f9',
          }}
        >
          <ResultList
            items={listItems}
            onSelect={(item) => focusMarker(item.lat, item.lng, item.marker)}
          />
        </div>
      )}
    </div>
  )
}
