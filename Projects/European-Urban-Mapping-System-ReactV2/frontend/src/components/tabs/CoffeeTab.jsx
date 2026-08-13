import { useState } from 'react'
import { useMap } from '../../context/MapContext'
import { usePoi } from '../../context/PoiContext'
import { useSearchLocation } from '../../hooks/useSearchLocation'
import {
  buildListSubtitle,
  collectCoffeeFromOsmResult,
  filterOsmCoffee,
  getPlaceTypeLabel,
} from '../../utils/poiDisplay'
import SearchLocationPanel from '../SearchLocationPanel'
import ResultList from '../ResultList'

export default function CoffeeTab({ setStatus }) {
  const { showCoffeeMarkers, clearCoffeeMarkers, focusMarker, setSearchLocation } =
    useMap()
  const { fetchPoiData } = usePoi()
  const [radius, setRadius] = useState(5)
  const [placeType, setPlaceType] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [outdoorOnly, setOutdoorOnly] = useState(false)
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(false)
  const [listItems, setListItems] = useState([])
  const [count, setCount] = useState(0)
  const [searched, setSearched] = useState(false)

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

  const renderCoffee = (features) => {
    if (!visible) {
      clearCoffeeMarkers()
      setListItems([])
      setCount(0)
      return
    }
    const markers = showCoffeeMarkers(features)
    const items = features.slice(0, 200).map((feature, index) => {
      const [lngM, latM] = feature.geometry.coordinates
      const props = feature.properties
      return {
        name: props.name || 'Café',
        icon: props.icon || '☕',
        category: getPlaceTypeLabel(props),
        subtitle: buildListSubtitle(props),
        distance: props.distance_km,
        lat: latM,
        lng: lngM,
        marker: markers[index],
      }
    })
    setListItems(items)
    setCount(items.length)
    const withHours = features.filter((f) => f.properties?.opening_hours).length
    setStatus({
      type: items.length ? 'success' : 'warning',
      message: items.length
        ? `Showing ${items.length} coffee spots (${withHours} with opening hours in OpenStreetMap)`
        : `No cafés within ${radius} km — try a larger radius.`,
    })
  }

  const handleShowCoffee = async () => {
    const coords = requireCoords()
    if (!coords) return

    setLoading(true)
    setStatus({ type: 'info', message: 'Loading cafés…' })
    try {
      const osmResult = await fetchPoiData(coords.lat, coords.lng, radius, true)
      setSearchLocation(coords.lat, coords.lng, {
        radiusKm: radius,
        popup: '<strong>☕ Coffee search</strong>',
        panZoom: 14,
      })
      const candidates = collectCoffeeFromOsmResult(osmResult)
      const coffee = filterOsmCoffee(candidates, {
        placeType: placeType || undefined,
        priceRange: priceFilter || undefined,
        outdoorSeating: outdoorOnly || undefined,
      })
      setSearched(true)
      renderCoffee(coffee)
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || 'Failed to load cafés',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="controls">
      <h3>Coffee &amp; Cafés</h3>
      <p className="info-text">
        Cafés, coffee shops, and bakeries from OpenStreetMap — hours, outdoor
        seating, and contact details when tagged.
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
          min={0.5}
          max={50}
          step={0.5}
          onChange={(e) => setRadius(parseFloat(e.target.value) || 5)}
        />
      </div>

      <div className="form-group">
        <label>Place Type:</label>
        <select
          value={placeType}
          onChange={(e) => setPlaceType(e.target.value)}
        >
          <option value="">All coffee spots</option>
          <option value="cafe">☕ Café</option>
          <option value="coffee_shop">☕ Coffee shop</option>
          <option value="bakery">🥐 Bakery / pastry</option>
        </select>
      </div>

      <div className="form-group">
        <label>Price Range:</label>
        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
        >
          <option value="">All Prices</option>
          <option value="luxury">€€€ Luxury</option>
          <option value="moderate">€€ Moderate</option>
          <option value="budget">€ Budget</option>
        </select>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={outdoorOnly}
            onChange={(e) => setOutdoorOnly(e.target.checked)}
          />{' '}
          Outdoor seating only
        </label>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => {
              setVisible(e.target.checked)
              if (!e.target.checked) {
                clearCoffeeMarkers()
                setListItems([])
                setCount(0)
              } else if (listItems.length) {
                handleShowCoffee()
              }
            }}
          />{' '}
          Show on map
        </label>
      </div>

      <button type="button" disabled={loading} onClick={handleShowCoffee}>
        🔍 Show Coffee
      </button>
      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: '0.5rem' }}
        onClick={() => {
          clearCoffeeMarkers()
          setListItems([])
          setCount(0)
          setSearched(false)
        }}
      >
        Clear Coffee
      </button>

      <div className="stat-item" style={{ marginTop: '1rem' }}>
        <strong>Places Shown:</strong> <span>{count}</span>
      </div>

      {searched && (
        <div
          style={{
            marginTop: '1rem',
            maxHeight: 250,
            overflowY: 'auto',
            border: '1px solid #ddd',
            borderRadius: 4,
            padding: '0.5rem',
            background: '#f9f9f9',
          }}
        >
          <ResultList
            items={listItems}
            emptyMessage="No coffee spots match your filters — try a larger radius or clear filters."
            onSelect={(item) => focusMarker(item.lat, item.lng, item.marker)}
          />
        </div>
      )}
    </div>
  )
}
