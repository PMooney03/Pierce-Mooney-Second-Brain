import { useState } from 'react'
import { useMap } from '../../context/MapContext'
import { usePoi } from '../../context/PoiContext'
import { useSearchLocation } from '../../hooks/useSearchLocation'
import {
  buildListSubtitle,
  filterOsmRestaurants,
  getPlaceTypeLabel,
} from '../../utils/poiDisplay'
import SearchLocationPanel from '../SearchLocationPanel'
import ResultList from '../ResultList'

export default function RestaurantsTab({ setStatus }) {
  const { showRestaurantMarkers, clearRestaurantMarkers, focusMarker } =
    useMap()
  const { fetchPoiData } = usePoi()
  const [radius, setRadius] = useState(5)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [cuisineFilter, setCuisineFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(false)
  const [listItems, setListItems] = useState([])
  const [count, setCount] = useState(0)

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

  const renderRestaurants = (features) => {
    if (!visible) {
      clearRestaurantMarkers()
      setListItems([])
      setCount(0)
      return
    }
    const markers = showRestaurantMarkers(features)
    const items = features.slice(0, 200).map((feature, index) => {
      const [lngM, latM] = feature.geometry.coordinates
      const props = feature.properties
      return {
        name: props.name || 'Restaurant',
        icon: props.icon || '🍽️',
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
    const withDetails = features.filter(
      (f) => f.properties?.cuisine || f.properties?.price_range,
    ).length
    setStatus({
      type: items.length ? 'success' : 'warning',
      message: items.length
        ? `Showing ${items.length} places (${withDetails} with cuisine or price in OpenStreetMap)`
        : `No restaurants within ${radius} km — try a larger radius or different filters.`,
    })
  }

  const handleShowRestaurants = async () => {
    const coords = requireCoords()
    if (!coords) return

    setLoading(true)
    setStatus({ type: 'info', message: 'Loading restaurants…' })
    try {
      const osmResult = await fetchPoiData(coords.lat, coords.lng, radius, true)
      const filters = {
        category: categoryFilter || undefined,
        cuisine: cuisineFilter.trim() || undefined,
        priceRange: priceFilter || undefined,
      }
      const restaurants = filterOsmRestaurants(
        [
          ...(osmResult.categorized?.restaurants || []),
          ...(osmResult.categorized?.cafesPubsBars || []),
        ],
        filters,
      )
      renderRestaurants(restaurants)
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || 'Failed to load restaurants',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="controls">
      <h3>Restaurants</h3>
      <p className="info-text">
        Restaurants, cafés, pubs, and bars from OpenStreetMap — cuisine, price,
        hours, and contact details when tagged.
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All food & drink</option>
          <option value="restaurant">🍽️ Restaurant</option>
          <option value="fast_food">🍔 Fast food</option>
          <option value="food_court">🍱 Food court</option>
          <option value="cafe">☕ Café</option>
          <option value="pub">🍺 Pub</option>
          <option value="bar">🍸 Bar</option>
        </select>
      </div>

      <div className="form-group">
        <label>Cuisine (contains):</label>
        <input
          type="text"
          value={cuisineFilter}
          placeholder="e.g. spanish, seafood, pizza"
          onChange={(e) => setCuisineFilter(e.target.value)}
        />
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
            checked={visible}
            onChange={(e) => {
              setVisible(e.target.checked)
              if (!e.target.checked) {
                clearRestaurantMarkers()
                setListItems([])
                setCount(0)
              } else if (listItems.length) {
                handleShowRestaurants()
              }
            }}
          />{' '}
          Show on map
        </label>
      </div>

      <button type="button" disabled={loading} onClick={handleShowRestaurants}>
        🔍 Show Restaurants
      </button>
      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: '0.5rem' }}
        onClick={() => {
          clearRestaurantMarkers()
          setListItems([])
          setCount(0)
        }}
      >
        Clear Restaurants
      </button>

      <div className="stat-item" style={{ marginTop: '1rem' }}>
        <strong>Places Shown:</strong> <span>{count}</span>
      </div>

      {listItems.length > 0 && (
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
            onSelect={(item) => focusMarker(item.lat, item.lng, item.marker)}
          />
        </div>
      )}
    </div>
  )
}
