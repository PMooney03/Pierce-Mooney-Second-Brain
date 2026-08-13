import { useState } from 'react'
import FeatureToggles from './FeatureToggles'
import FilterTab from './tabs/FilterTab'
import ProximityTab from './tabs/ProximityTab'
import RegionsTab from './tabs/RegionsTab'
import HotelsTab from './tabs/HotelsTab'
import RestaurantsTab from './tabs/RestaurantsTab'
import CoffeeTab from './tabs/CoffeeTab'
import LandmarksTab from './tabs/LandmarksTab'
import AllPoisTab from './tabs/AllPoisTab'
import SavedTab from './tabs/SavedTab'
import { useMap } from '../context/MapContext'
import { usePoi } from '../context/PoiContext'

function SidebarStatus({ status }) {
  if (!status?.message) return null
  return (
    <div
      className={`sidebar-status visible ${status.type || 'info'}`}
      role="status"
      aria-live="polite"
    >
      {status.message}
    </div>
  )
}

export default function Sidebar({ activeFeatures, onToggleFeature }) {
  const [status, setStatus] = useState(null)
  const { cityCount, proximityPoiCount } = useMap()
  const { poiFeatures } = usePoi()

  return (
    <aside className="sidebar">
      <SidebarStatus status={status} />
      <FeatureToggles
        activeFeatures={activeFeatures}
        onToggle={onToggleFeature}
      />

      {activeFeatures.filter && (
        <div className="tab-content active">
          <FilterTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.proximity && (
        <div className="tab-content active">
          <ProximityTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.regions && (
        <div className="tab-content active">
          <RegionsTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.hotels && (
        <div className="tab-content active">
          <HotelsTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.restaurants && (
        <div className="tab-content active">
          <RestaurantsTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.coffee && (
        <div className="tab-content active">
          <CoffeeTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.landmarks && (
        <div className="tab-content active">
          <LandmarksTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.allpois && (
        <div className="tab-content active">
          <AllPoisTab setStatus={setStatus} />
        </div>
      )}
      {activeFeatures.saved && (
        <div className="tab-content active">
          <SavedTab setStatus={setStatus} active={activeFeatures.saved} />
        </div>
      )}
      {activeFeatures.stats && (
        <div className="tab-content active">
          <div className="stats">
            <h3>Statistics</h3>
            <div className="stat-item">
              <strong>Filter cities on map:</strong>
              <span>{cityCount}</span>
            </div>
            <div className="stat-item">
              <strong>Proximity POIs on map:</strong>
              <span>{proximityPoiCount}</span>
            </div>
            <div className="stat-item">
              <strong>POI data loaded:</strong>
              <span>{poiFeatures.length}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
