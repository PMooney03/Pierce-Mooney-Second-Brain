export default function SearchLocationPanel({
  lat,
  lng,
  setLat,
  setLng,
  mapClickMode,
  onToggleMapClick,
  onUseLocation,
  locating,
  compact = false,
}) {
  return (
    <div
      style={{
        background: compact
          ? '#f8f9fa'
          : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
        padding: compact ? '0.75rem' : '1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        border: compact ? '1px solid #e0e0e0' : '2px solid #90caf9',
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
        📍 Search location
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
            placeholder="Click map or enter"
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
            placeholder="Click map or enter"
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
        onClick={onToggleMapClick}
      >
        {mapClickMode
          ? '❌ Disable Map Click'
          : '📍 Click Map to Set Location'}
      </button>
      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%', marginTop: '0.5rem' }}
        disabled={locating}
        onClick={onUseLocation}
      >
        {locating ? '📍 Locating…' : '📍 Use My Location'}
      </button>
    </div>
  )
}
