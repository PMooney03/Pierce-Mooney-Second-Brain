export default function ResultList({ items, onSelect, emptyMessage }) {
  if (!items?.length) {
    return (
      <p style={{ color: '#999', fontSize: '0.85rem' }}>
        {emptyMessage || 'No results'}
      </p>
    )
  }

  return items.map((item, index) => (
    <div
      key={`${item.name}-${item.lat}-${index}`}
      className="result-item"
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect?.(item)
      }}
    >
      <strong style={{ color: '#2c3e50', fontSize: '0.9rem' }}>
        {item.icon} {item.name}
        {item.country ? `, ${item.country}` : ''}
      </strong>
      <br />
      <small style={{ color: '#7f8c8d', fontSize: '0.8rem' }}>
        {item.subtitle || item.category}
        {item.population != null
          ? ` • Pop: ${item.population.toLocaleString()}`
          : ''}
        {item.distance != null ? (
          <>
            {' '}
            •{' '}
            <span style={{ color: '#667eea', fontWeight: 600 }}>
              {Number(item.distance).toFixed(2)} km
            </span>{' '}
            away
          </>
        ) : null}
      </small>
    </div>
  ))
}
