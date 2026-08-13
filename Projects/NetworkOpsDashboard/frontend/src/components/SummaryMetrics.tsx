import type { DashboardSummary } from '../types'

function formatAverage(value: number | null): string {
  if (value == null) {
    return '—'
  }
  return `${value.toFixed(1)} ms`
}

export function SummaryMetrics({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="metrics" aria-label="Dashboard summary">
      <div className="metric">
        <div className="label">Total devices</div>
        <div className="value">{summary.totalDevices}</div>
      </div>
      <div className="metric">
        <div className="label">Online</div>
        <div className="value">{summary.onlineDevices}</div>
      </div>
      <div className="metric">
        <div className="label">Offline</div>
        <div className="value">{summary.offlineDevices}</div>
      </div>
      <div className="metric">
        <div className="label">Degraded</div>
        <div className="value">{summary.degradedDevices}</div>
      </div>
      <div className="metric">
        <div className="label">Avg response</div>
        <div className="value">{formatAverage(summary.averageResponseTimeMs)}</div>
      </div>
    </section>
  )
}
