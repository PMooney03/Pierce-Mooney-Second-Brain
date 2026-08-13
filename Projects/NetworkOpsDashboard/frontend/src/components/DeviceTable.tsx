import { useNavigate } from 'react-router-dom'
import type { Device } from '../types'
import { StatusBadge } from './StatusBadge'

function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString()
}

export function DeviceTable({ devices }: { devices: Device[] }) {
  const navigate = useNavigate()

  if (devices.length === 0) {
    return <div className="empty">No devices match the current filters.</div>
  }

  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hostname</th>
            <th>IP</th>
            <th>Type</th>
            <th>Location</th>
            <th>Status</th>
            <th>Response</th>
            <th>Last checked</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr
              key={device.id}
              className="clickable"
              onClick={() => navigate(`/devices/${device.id}`)}
            >
              <td>{device.hostname}</td>
              <td className="mono">{device.ipAddress}</td>
              <td>{device.deviceType}</td>
              <td>{device.location}</td>
              <td>
                <StatusBadge status={device.status} />
              </td>
              <td className="mono">
                {device.responseTimeMs == null ? '—' : `${device.responseTimeMs} ms`}
              </td>
              <td>{formatDate(device.lastCheckedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
