import { useCallback, useState } from 'react'
import { getGpsPosition, resolveNetworkLocation } from '../api/location'

export function useGeolocation() {
  const [locating, setLocating] = useState(false)

  const useMyLocation = useCallback(async (onResult, onStatus) => {
    setLocating(true)
    const finish = () => setLocating(false)

    const applyNetwork = async () => {
      onStatus?.({
        type: 'info',
        message: 'Getting location from your mobile network…',
      })
      try {
        const loc = await resolveNetworkLocation()
        onResult(loc)
        onStatus?.({
          type: 'success',
          message: `Network location: ${loc.label}. Use https:// for GPS.`,
        })
      } catch (error) {
        console.error(error)
        onStatus?.({
          type: 'error',
          message:
            'Could not detect location. Use https://, allow GPS, or click the map.',
        })
      } finally {
        finish()
      }
    }

    if (!window.isSecureContext) {
      onStatus?.({
        type: 'warning',
        message: 'GPS requires https:// on mobile. Using network location…',
      })
      await applyNetwork()
      return
    }

    if (!navigator.geolocation) {
      await applyNetwork()
      return
    }

    onStatus?.({ type: 'info', message: 'Getting precise GPS location…' })

    try {
      const position = await getGpsPosition()
      const accuracy = position.coords.accuracy
        ? ` (±${Math.round(position.coords.accuracy)} m)`
        : ''
      onResult({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: `Your location${accuracy}`,
        approximate: false,
      })
      onStatus?.({
        type: 'success',
        message: `GPS location found${accuracy} — loading nearby places…`,
      })
    } catch (error) {
      const messages = {
        1: 'GPS permission denied.',
        2: 'GPS unavailable.',
        3: 'GPS timed out.',
      }
      onStatus?.({
        type: 'warning',
        message: `${messages[error.code] || error.message} Trying network location…`,
      })
      await applyNetwork()
    } finally {
      finish()
    }
  }, [])

  return { locating, useMyLocation }
}
