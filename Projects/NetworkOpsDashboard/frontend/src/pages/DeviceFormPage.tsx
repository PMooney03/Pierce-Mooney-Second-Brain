import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createDevice, getDevice, updateDevice } from '../api/devices'
import { toApiError } from '../api/client'
import { DeviceForm } from '../components/DeviceForm'
import { ErrorAlert } from '../components/ErrorAlert'
import type { DeviceRequest } from '../types'

export function DeviceFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const deviceId = id ? Number(id) : null

  const [initialValues, setInitialValues] = useState<DeviceRequest | undefined>()
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!isEdit || deviceId == null || !Number.isFinite(deviceId)) {
      return
    }

    const idToLoad = deviceId
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const device = await getDevice(idToLoad)
        if (!cancelled) {
          setInitialValues({
            hostname: device.hostname,
            ipAddress: device.ipAddress,
            deviceType: device.deviceType,
            location: device.location,
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError(toApiError(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isEdit, deviceId])

  async function handleSubmit(values: DeviceRequest) {
    setError(null)
    try {
      if (isEdit && deviceId != null) {
        const updated = await updateDevice(deviceId, values)
        navigate(`/devices/${updated.id}`)
      } else {
        const created = await createDevice(values)
        navigate(`/devices/${created.id}`)
      }
    } catch (err) {
      setError(toApiError(err))
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{isEdit ? 'Edit device' : 'Add device'}</h1>
          <p>
            {isEdit
              ? 'Update registration details. Status continues to be simulated by the backend.'
              : 'Register a network device. Status starts as UNKNOWN until the next check.'}
          </p>
        </div>
      </div>

      <ErrorAlert error={error} />

      {loading ? (
        <div className="empty">Loading device…</div>
      ) : (
        <DeviceForm
          initialValues={initialValues}
          submitLabel={isEdit ? 'Save changes' : 'Create device'}
          onSubmit={handleSubmit}
          onCancel={() => navigate(isEdit && deviceId ? `/devices/${deviceId}` : '/devices')}
        />
      )}
    </div>
  )
}
