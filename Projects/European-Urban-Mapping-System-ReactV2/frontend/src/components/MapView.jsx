import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMap } from '../context/MapContext'

export default function MapView() {
  const containerRef = useRef(null)
  const { registerMap, handleMapClick } = useMap()

  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current).setView([20.0, 0.0], 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    map.on('click', (e) => {
      handleMapClick(e.latlng)
    })

    registerMap(map)

    return () => {
      map.remove()
    }
  }, [registerMap, handleMapClick])

  return (
    <div className="map-container">
      <div id="map" ref={containerRef} />
    </div>
  )
}
