import { useState } from 'react'
import { fetchCitiesGeoJSON, quickSearchCities } from '../../api/cities'
import { useMap } from '../../context/MapContext'

export default function FilterTab({ setStatus }) {
  const { clearCityMarkers, showCityGeoJSON } = useMap()
  const [quickSearch, setQuickSearch] = useState('')
  const [country, setCountry] = useState('')
  const [popMin, setPopMin] = useState('0')
  const [popMax, setPopMax] = useState('')
  const [cityType, setCityType] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLoadCities() {
    setLoading(true)
    setStatus(null)
    try {
      const data = await fetchCitiesGeoJSON({
        populationMin: popMin,
        populationMax: popMax,
        country,
        cityType,
      })
      showCityGeoJSON(data)
      setStatus({
        type: 'success',
        message: `Loaded ${data.features?.length ?? 0} cities on the map.`,
      })
    } catch (err) {
      console.error(err)
      setStatus({ type: 'error', message: err.message || 'Failed to load cities' })
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickSearch() {
    setLoading(true)
    setStatus(null)
    try {
      const data = await quickSearchCities(quickSearch)
      if (!data.features?.length) {
        setStatus({ type: 'warning', message: 'No cities found for that search.' })
        clearCityMarkers()
        return
      }
      showCityGeoJSON(data, { fitBounds: true })
      setStatus({
        type: 'success',
        message: `Found ${data.features.length} cities.`,
      })
    } catch (err) {
      console.error(err)
      setStatus({
        type: 'warning',
        message: err.message || 'Search failed',
      })
    } finally {
      setLoading(false)
    }
  }

  function handleClearMap() {
    clearCityMarkers()
    setStatus({ type: 'info', message: 'City markers cleared from the map.' })
  }

  return (
    <div className="controls">
      <h3>🔍 Search & Filter Cities</h3>
      <p className="info-text">
        Find cities by name, country, population, or type
      </p>

      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="quick-search">Quick Search:</label>
        <input
          id="quick-search"
          type="text"
          placeholder="Search by city or country name..."
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleQuickSearch()
          }}
          style={{ padding: '0.875rem', fontSize: '1rem' }}
        />
        <button
          type="button"
          style={{ marginTop: '0.5rem' }}
          onClick={handleQuickSearch}
          disabled={loading}
        >
          🔍 Search
        </button>
      </div>

      <div
        style={{
          borderTop: '2px solid #e0e0e0',
          paddingTop: '1rem',
          marginTop: '1rem',
        }}
      >
        <h4
          style={{
            color: '#2c3e50',
            fontSize: '0.95rem',
            marginBottom: '0.75rem',
            fontWeight: 600,
          }}
        >
          Advanced Filters
        </h4>

        <div className="form-group">
          <label htmlFor="country">Country:</label>
          <input
            id="country"
            type="text"
            placeholder="e.g., France, Nigeria, United States"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
          }}
        >
          <div className="form-group">
            <label htmlFor="pop-min">Min Population:</label>
            <input
              id="pop-min"
              type="number"
              value={popMin}
              onChange={(e) => setPopMin(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label htmlFor="pop-max">Max Population:</label>
            <input
              id="pop-max"
              type="number"
              value={popMax}
              onChange={(e) => setPopMax(e.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="city-type">City Type:</label>
          <select
            id="city-type"
            value={cityType}
            onChange={(e) => setCityType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="capital">👑 Capital Cities</option>
            <option value="major">🏙️ Major Cities</option>
            <option value="regional">🏘️ Regional Cities</option>
            <option value="town">🏡 Towns</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        style={{ marginTop: '1rem' }}
        onClick={handleLoadCities}
        disabled={loading}
      >
        🔍 Apply Filters
      </button>
      <button
        type="button"
        className="btn-danger"
        style={{ marginTop: '0.5rem' }}
        onClick={handleClearMap}
        disabled={loading}
      >
        🗑️ Clear Map
      </button>
    </div>
  )
}
