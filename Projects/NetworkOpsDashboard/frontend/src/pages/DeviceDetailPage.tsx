import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteDevice, getDevice, getDeviceHistory } from '../api/devices'
import { toApiError } from '../api/client'
import { ErrorAlert } from '../components/ErrorAlert'
import { StatusBadge } from '../components/StatusBadge'
import type { Device, StatusCheck } from '../types'

function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString()
}

export function DeviceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const deviceId = Number(id)

  const [device, setDevice] = useState<Device | null>(null)
  const [history, setHistory] = useState<StatusCheck[]>([])
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!Number.isFinite(deviceId)) {
        setError(toApiError(new Error('Invalid device id')))
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const [deviceData, historyData] = await Promise.all([
          getDevice(deviceId),
          getDeviceHistory(deviceId, 20),
        ])
        if (!cancelled) {
          setDevice(deviceData)
          setHistory(historyData)
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
  }, [deviceId])

  async function handleDelete() {
    if (!device) {
      return
    }
    const confirmed = window.confirm(`Delete ${device.hostname}? This cannot be undone.`)
    if (!confirmed) {
      return
    }

    setDeleting(true)
    setError(null)
    try {
      await deleteDevice(device.id)
      navigate('/devices')
    } catch (err) {
      setError(toApiError(err))
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{device?.hostname ?? 'Device'}</h1>
          <p>Details, live status fields, and recent simulated checks.</p>
        </div>
        <div className="topbar-actions">
          <Link className="btn" to="/devices">
            Back
          </Link>
          {device && (
            <>
              <Link className="btn" to={`/devices/${device.id}/edit`}>
                Edit
              </Link>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </div>

      <ErrorAlert error={error} />

      {loading && <div className="empty">Loading device…</div>}

      {!loading && device && (
        <>
          <section className="panel detail-grid">
            <div className="detail-item">
              <div className="label">Hostname</div>
              <div className="value">{device.hostname}</div>
            </div>
            <div className="detail-item">
              <div className="label">IP address</div>
              <div className="value mono">{device.ipAddress}</div>
            </div>
            <div className="detail-item">
              <div className="label">Type</div>
              <div className="value">{device.deviceType}</div>
            </div>
            <div className="detail-item">
              <div className="label">Location</div>
              <div className="value">{device.location}</div>
            </div>
            <div className="detail-item">
              <div className="label">Status</div>
              <div className="value">
                <StatusBadge status={device.status} />
              </div>
            </div>
            <div className="detail-item">
              <div className="label">Response time</div>
              <div className="value mono">
                {device.responseTimeMs == null ? '—' : `${device.responseTimeMs} ms`}
              </div>
            </div>
            <div className="detail-item">
              <div className="label">Last checked</div>
              <div className="value">{formatDate(device.lastCheckedAt)}</div>
            </div>
            <div className="detail-item">
              <div className="label">Updated</div>
              <div className="value">{formatDate(device.updatedAt)}</div>
            </div>
          </section>

          <section className="stack">
            <div>
              <h2>Status history</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Newest checks first. Values are simulated by the backend scheduler.
              </p>
            </div>

            <div className="panel table-wrap">
              {history.length === 0 ? (
                <div className="empty">No checks yet. Wait about 30 seconds and refresh.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Checked at</th>
                      <th>Status</th>
                      <th>Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((check) => (
                      <tr key={check.id}>
                        <td>{formatDate(check.checkedAt)}</td>
                        <td>
                          <StatusBadge status={check.status} />
                        </td>
                        <td className="mono">
                          {check.responseTimeMs == null ? '—' : `${check.responseTimeMs} ms`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
