export const SAVED_STORAGE_KEY = 'urbanMappingSavedPlaces'

export function getSavedPlaces() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function savePlace(place) {
  const places = getSavedPlaces()
  const id = `${place.lat.toFixed(5)}_${place.lng.toFixed(5)}_${place.name}`
  if (places.some((p) => p.id === id)) {
    return { ok: false, message: 'Already in saved places.' }
  }
  places.unshift({ ...place, id, savedAt: Date.now() })
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(places))
  return { ok: true, message: `Saved "${place.name}"` }
}

export function removeSavedPlace(id) {
  const places = getSavedPlaces().filter((p) => p.id !== id)
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(places))
}

export function clearAllSavedPlaces() {
  localStorage.removeItem(SAVED_STORAGE_KEY)
}

export function registerSavePlaceGlobal(onSaved) {
  if (typeof window === 'undefined') return
  window.saveUrbanPlace = (encoded) => {
    try {
      const place = JSON.parse(decodeURIComponent(encoded))
      const result = savePlace(place)
      onSaved?.(result)
    } catch {
      onSaved?.({ ok: false, message: 'Could not save place.' })
    }
  }
}
