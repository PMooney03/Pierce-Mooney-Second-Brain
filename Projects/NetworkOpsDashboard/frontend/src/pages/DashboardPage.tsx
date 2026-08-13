import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardSummary } from '../api/dashboard'
import { listDevices } from '../api/devices'
import { toApiError } from '../api/client'
import { ErrorAlert } from '../components/ErrorAlert'
import { SummaryMetrics } from '../components/SummaryMetrics'
import { DeviceTable } from '../components/DeviceTable'
import type { DashboardSummary, Device } from '../types'

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [summaryData, devicePage] = await Promise.all([
          getDashboardSummary(),
          listDevices({ size: 10 }),
        ])
        if (!cancelled) {
          setSummary(summaryData)
          setDevices(devicePage.content)
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
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Live summary of registered devices and recent inventory.</p>
        </div>
        <Link className="btn btn-primary" to="/devices/new">
          Add device
        </Link>
      </div>

      <ErrorAlert error={error} />

      {loading && <div className="empty">Loading dashboard…</div>}

      {!loading && summary && <SummaryMetrics summary={summary} />}

      {!loading && (
        <section className="stack">
          <div className="page-header">
            <div>
              <h2>Recent devices</h2>
              <p>Click a row to view history and edit details.</p>
            </div>
            <Link className="btn" to="/devices">
              View all
            </Link>
          </div>
          <DeviceTable devices={devices} />
        </section>
      )}
    </div>
  )
}
