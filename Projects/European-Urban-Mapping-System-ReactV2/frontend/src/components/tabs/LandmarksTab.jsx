import { useRef, useState } from 'react'
import { useMap } from '../../context/MapContext'
import { usePoi } from '../../context/PoiContext'
import { useSearchLocation } from '../../hooks/useSearchLocation'
import SearchLocationPanel from '../SearchLocationPanel'
import ResultList from '../ResultList'

export default function LandmarksTab({ setStatus }) {
  const { showLandmarkMarkers, clearLandmarkMarkers, focusMarker } = useMap()
  const { fetchPoiData } = usePoi()
  const [radius, setRadius] = useState(10)
  const [visible, setVisible] = useState(true)
  const [landmarkType, setLandmarkType] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const rawLandmarksRef = useRef([])

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
    let landmarks = source ?? rawLandmarksRef.current
    if (landmarkType) {
      landmarks = landmarks.filter(
        (f) => f.properties?.type === landmarkType,
      )
    }
    if (!visible) {
      clearLandmarkMarkers()
      setItems([])
      setCount(0)
      return
    }
    const markers = showLandmarkMarkers(landmarks)
    const list = landmarks.slice(0, 200).map((feature, index) => {
      const [lngM, latM] = feature.geometry.coordinates
      const props = feature.properties
      return {
        name: props.name || 'Landmark',
        icon: props.icon || '🎯',
        category: props.category,
        distance: props.distance_km,
        lat: latM,
        lng: lngM,
        marker: markers[index],
      }
    })
    setItems(list)
    setCount(list.length)
  }

  const handleFetch = async () => {
    const coords = requireCoords()
    if (!coords) return

    setLoading(true)
    setStatus({ type: 'info', message: 'Fetching landmarks from OpenStreetMap…' })
    try {
      const result = await fetchPoiData(
        coords.lat,
        coords.lng,
        radius,
        true,
      )
      rawLandmarksRef.current = result.categorized?.landmarks || []
      applyFilter(rawLandmarksRef.current)
      const shown = landmarkType
        ? rawLandmarksRef.current.filter(
            (f) => f.properties?.type === landmarkType,
          ).length
        : rawLandmarksRef.current.length
      setStatus({
        type: 'success',
        message: `Loaded ${shown} landmarks within ${radius} km`,
      })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Fetch failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="controls">
      <h3>Landmarks & POIs</h3>
      <p className="info-text">
        Tourist attractions and historic sites from OpenStreetMap
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
        <label>Search Radius (km):</label>
        <input
          type="number"
          value={radius}
          min={1}
          max={50}
          onChange={(e) => setRadius(parseFloat(e.target.value) || 10)}
        />
      </div>
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
          Show Landmarks
        </label>
      </div>
      <div className="form-group">
        <label>Landmark Type:</label>
        <select
          value={landmarkType}
          onChange={(e) => {
            setLandmarkType(e.target.value)
            applyFilter()
          }}
        >
          <option value="">All Types</option>
          <option value="tourism">Tourism</option>
          <option value="historic">Historic</option>
          <option value="amenity">Amenity</option>
        </select>
      </div>
      <button type="button" disabled={loading} onClick={handleFetch}>
        🔍 Fetch Landmarks
      </button>
      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: '0.5rem' }}
        onClick={() => {
          clearLandmarkMarkers()
          rawLandmarksRef.current = []
          setItems([])
          setCount(0)
        }}
      >
        Clear Landmarks
      </button>
      <div className="stat-item" style={{ marginTop: '1rem' }}>
        <strong>Landmarks Shown:</strong> <span>{count}</span>
      </div>
      {items.length > 0 && (
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
            items={items}
            onSelect={(item) => focusMarker(item.lat, item.lng, item.marker)}
          />
        </div>
      )}
    </div>
  )
}
