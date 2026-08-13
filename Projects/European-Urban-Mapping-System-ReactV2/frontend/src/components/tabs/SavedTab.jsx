import { useEffect, useState } from 'react'
import {
  clearAllSavedPlaces,
  getSavedPlaces,
  registerSavePlaceGlobal,
  removeSavedPlace,
} from '../../utils/savedPlaces'
import { googleMapsUrl } from '../../utils/leafletMarkers'
import { useMap } from '../../context/MapContext'

export default function SavedTab({ setStatus, active }) {
  const { showSavedMarkers, focusMarker } = useMap()
  const [places, setPlaces] = useState([])

  const refresh = () => {
    const list = getSavedPlaces()
    setPlaces(list)
    showSavedMarkers(list, active)
  }

  useEffect(() => {
    registerSavePlaceGlobal((result) => {
      if (result?.message) {
        setStatus({
          type: result.ok ? 'success' : 'info',
          message: result.message,
        })
      }
      refresh()
    })
    refresh()
  }, [active, setStatus, showSavedMarkers])

  return (
    <div className="controls">
      <h3>⭐ Saved Places</h3>
      <p className="info-text">
        Places you saved from the map. Stored on this device only.
      </p>
      <div className="stat-item">
        <strong>Saved:</strong> <span>{places.length}</span>
      </div>
      <div style={{ marginTop: '1rem', maxHeight: 400, overflowY: 'auto' }}>
        {!places.length ? (
          <p style={{ color: '#999' }}>
            No saved places yet. Tap ⭐ Save on any place popup.
          </p>
        ) : (
          places.map((place) => (
            <div key={place.id} className="result-item">
              <strong>
                {place.icon || '⭐'} {place.name}
              </strong>
              <br />
              <small style={{ color: '#7f8c8d' }}>
                {place.category || place.type || 'place'}
              </small>
              <div className="saved-item-actions">
                <a
                  href={googleMapsUrl(place.lat, place.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="popup-btn popup-btn-maps"
                >
                  Google Maps
                </a>
                <button
                  type="button"
                  className="popup-btn popup-btn-save"
                  onClick={() => {
                    const markers = showSavedMarkers(places, true)
                    const m = markers?.find(
                      (mk) =>
                        mk.getLatLng().lat === place.lat &&
                        mk.getLatLng().lng === place.lng,
                    )
                    focusMarker(place.lat, place.lng, m)
                  }}
                >
                  Show on map
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  style={{
                    width: 'auto',
                    padding: '0.3rem 0.55rem',
                    fontSize: '0.72rem',
                  }}
                  onClick={() => {
                    removeSavedPlace(place.id)
                    refresh()
                    setStatus({ type: 'info', message: 'Place removed.' })
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        className="btn-danger"
        style={{ marginTop: '1rem' }}
        onClick={() => {
          clearAllSavedPlaces()
          refresh()
          setStatus({ type: 'info', message: 'All saved places cleared.' })
        }}
      >
        Clear All Saved
      </button>
    </div>
  )
}
