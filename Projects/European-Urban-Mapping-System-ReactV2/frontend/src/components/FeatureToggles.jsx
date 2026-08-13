const FEATURES = [
  { id: 'filter', label: '🏙️ Filter Cities' },
  { id: 'proximity', label: '📍 Proximity' },
  { id: 'regions', label: '🗺️ Regions' },
  { id: 'hotels', label: '🏨 Hotels' },
  { id: 'restaurants', label: '🍽️ Restaurants' },
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'landmarks', label: '⭐ Landmarks' },
  { id: 'allpois', label: '🌍 All POIs' },
  { id: 'saved', label: '⭐ Saved' },
  { id: 'stats', label: '📊 Stats' },
]

export default function FeatureToggles({ activeFeatures, onToggle }) {
  return (
    <div className="feature-toggles">
      {FEATURES.map(({ id, label }) => {
        const active = activeFeatures[id]
        return (
          <button
            key={id}
            type="button"
            className={`toggle-btn${active ? ' active' : ''}`}
            onClick={() => onToggle(id)}
          >
            <span className="toggle-icon">{active ? '✓' : ''}</span>
            <span className="toggle-btn-text">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
