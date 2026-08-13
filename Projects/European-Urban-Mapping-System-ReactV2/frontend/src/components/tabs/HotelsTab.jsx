import { useState } from 'react'
import { fetchNearbyDbHotels } from '../../api/hotels'
import { useMap } from '../../context/MapContext'
import { usePoi } from '../../context/PoiContext'
import { useSearchLocation } from '../../hooks/useSearchLocation'
import { buildListSubtitle, filterOsmHotels } from '../../utils/poiDisplay'
import SearchLocationPanel from '../SearchLocationPanel'
import ResultList from '../ResultList'

export default function HotelsTab({ setStatus }) {
  const { showHotelMarkers, clearHotelMarkers, focusMarker } = useMap()
  const { fetchPoiData } = usePoi()
  const [radius, setRadius] = useState(5)
  const [starFilter, setStarFilter] = useState('')
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

  const renderHotels = (features) => {
    if (!visible) {
      clearHotelMarkers()
      setListItems([])
      setCount(0)
      return
    }
    const markers = showHotelMarkers(features)
    const items = features.slice(0, 200).map((feature, index) => {
      const [lngM, latM] = feature.geometry.coordinates
      const props = feature.properties
      return {
        name: props.name || 'Hotel',
        icon: props.icon || '🏨',
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
    const dbCount = features.filter(
      (f) => f.properties?.source === 'database',
    ).length
    const osmCount = items.length - dbCount
    setStatus({
      type: items.length ? 'success' : 'warning',
      message: items.length
        ? `Showing ${items.length} hotels (${dbCount} with star/price data, ${osmCount} from OSM)`
        : `No hotels within ${radius} km — try a larger radius or different filters.`,
    })
  }

  const handleShowHotels = async () => {
    const coords = requireCoords()
    if (!coords) return

    setLoading(true)
    setStatus({ type: 'info', message: 'Loading hotels…' })
    try {
      const filters = {
        star_rating: starFilter || undefined,
        price_range: priceFilter || undefined,
      }
      const [osmResult, dbData] = await Promise.all([
        fetchPoiData(coords.lat, coords.lng, radius, true),
        fetchNearbyDbHotels(coords.lat, coords.lng, radius, filters),
      ])

      let osmHotels = filterOsmHotels(osmResult.categorized?.hotels || [], {
        starRating: starFilter,
        priceRange: priceFilter,
      })
      const dbHotels = dbData.features || []
      renderHotels([...dbHotels, ...osmHotels])
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to load hotels' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="controls">
      <h3>Hotels</h3>
      <p className="info-text">
        Star ratings and prices from our hotel database (major cities), plus
        OpenStreetMap details (address, phone, website, facilities) when tagged.
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
        <label>Star Rating:</label>
        <select
          value={starFilter}
          onChange={(e) => setStarFilter(e.target.value)}
        >
          <option value="">All Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
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
            checked={visible}
            onChange={(e) => {
              setVisible(e.target.checked)
              if (!e.target.checked) {
                clearHotelMarkers()
                setListItems([])
                setCount(0)
              } else if (listItems.length) {
                handleShowHotels()
              }
            }}
          />{' '}
          Show Hotels on map
        </label>
      </div>

      <button type="button" disabled={loading} onClick={handleShowHotels}>
        🔍 Show Hotels
      </button>
      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: '0.5rem' }}
        onClick={() => {
          clearHotelMarkers()
          setListItems([])
          setCount(0)
        }}
      >
        Clear Hotels
      </button>

      <div className="stat-item" style={{ marginTop: '1rem' }}>
        <strong>Hotels Shown:</strong> <span>{count}</span>
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
