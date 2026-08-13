import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCitiesInRegion, fetchRegionsGeoJSON } from '../../api/regions'
import { useMap } from '../../context/MapContext'

export default function RegionsTab({ setStatus }) {
  const {
    loadRegionsGeoJSON,
    setRegionsOnMap,
    clearRegions,
    clearCityMarkers,
    showCityGeoJSON,
  } = useMap()
  const [country, setCountry] = useState('')
  const [showBoundaries, setShowBoundaries] = useState(true)
  const [selected, setSelected] = useState(null)
  const regionMapRef = useRef({})

  const loadCities = useCallback(
    async (regionId, regionName) => {
      try {
        const data = await fetchCitiesInRegion(regionId)
        clearCityMarkers()
        showCityGeoJSON(data, { fitBounds: true })
        setSelected({
          name: regionName,
          count: data.features?.length ?? 0,
        })
        setStatus({
          type: 'success',
          message: `Loaded ${data.features?.length ?? 0} cities in ${regionName}`,
        })
      } catch (err) {
        setStatus({
          type: 'error',
          message: err.message || 'Failed to load cities',
        })
      }
    },
    [clearCityMarkers, showCityGeoJSON, setStatus],
  )

  useEffect(() => {
    window.__urbanShowRegionCities = (code, name) => {
      const region = regionMapRef.current[code]
      if (region?.id) loadCities(region.id, name)
    }
    return () => {
      delete window.__urbanShowRegionCities
    }
  }, [loadCities])

  const handleLoad = async () => {
    try {
      const data = await fetchRegionsGeoJSON(country)
      if (!data.features?.length) {
        setStatus({
          type: 'warning',
          message: country
            ? `No regions found for "${country}". Try another country or leave blank.`
            : 'No regions in database — run seed_regions.',
        })
        return
      }
      regionMapRef.current = loadRegionsGeoJSON(data) || {}
      setShowBoundaries(true)
      setRegionsOnMap(true)
      setStatus({
        type: 'success',
        message: `Loaded ${data.features.length} regions — click a region for cities`,
      })
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || 'Failed to load regions',
      })
    }
  }

  const handleClear = () => {
    clearRegions()
    setSelected(null)
    regionMapRef.current = {}
  }

  return (
    <div className="controls">
      <h3>Regions</h3>
      <p className="info-text">
        Load region boundaries, then click a region on the map to list its cities
      </p>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={showBoundaries}
            onChange={(e) => {
              setShowBoundaries(e.target.checked)
              setRegionsOnMap(e.target.checked)
            }}
          />{' '}
          Show Region Boundaries
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="region-country">Filter by Country:</label>
        <input
          id="region-country"
          type="text"
          placeholder="e.g., France (optional)"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
      </div>
      <button type="button" onClick={handleLoad}>
        Load Regions
      </button>
      <button
        type="button"
        className="btn-danger"
        style={{ marginTop: '0.5rem' }}
        onClick={handleClear}
      >
        Clear Regions
      </button>
      {selected && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.5rem',
            background: '#ecf0f1',
            borderRadius: 4,
          }}
        >
          <strong>Selected Region:</strong>
          <p style={{ margin: '0.5rem 0' }}>{selected.name}</p>
          <p style={{ margin: '0.5rem 0', color: '#3498db' }}>
            {selected.count} cities found
          </p>
        </div>
      )}
    </div>
  )
}
