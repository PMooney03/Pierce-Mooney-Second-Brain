import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDevices } from '../api/devices'
import { toApiError } from '../api/client'
import { DeviceTable } from '../components/DeviceTable'
import { ErrorAlert } from '../components/ErrorAlert'
import type { Device, DeviceStatus, DeviceType } from '../types'

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [status, setStatus] = useState<DeviceStatus | ''>('')
  const [deviceType, setDeviceType] = useState<DeviceType | ''>('')
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const page = await listDevices({
          status,
          deviceType,
          page: 0,
          size: 50,
        })
        if (!cancelled) {
          setDevices(page.content)
          setTotal(page.totalElements)
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
  }, [status, deviceType])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Devices</h1>
          <p>
            {total} registered device{total === 1 ? '' : 's'}. Filter by status or type.
          </p>
        </div>
        <Link className="btn btn-primary" to="/devices/new">
          Add device
        </Link>
      </div>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="statusFilter">Status</label>
          <select
            id="statusFilter"
            value={status}
            onChange={(event) => setStatus(event.target.value as DeviceStatus | '')}
          >
            <option value="">All statuses</option>
            <option value="ONLINE">ONLINE</option>
            <option value="OFFLINE">OFFLINE</option>
            <option value="DEGRADED">DEGRADED</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="typeFilter">Device type</label>
          <select
            id="typeFilter"
            value={deviceType}
            onChange={(event) => setDeviceType(event.target.value as DeviceType | '')}
          >
            <option value="">All types</option>
            <option value="ROUTER">ROUTER</option>
            <option value="SWITCH">SWITCH</option>
            <option value="SERVER">SERVER</option>
            <option value="FIREWALL">FIREWALL</option>
            <option value="ACCESS_POINT">ACCESS_POINT</option>
          </select>
        </div>
      </div>

      <ErrorAlert error={error} />

      {loading ? <div className="empty">Loading devices…</div> : <DeviceTable devices={devices} />}
    </div>
  )
}
