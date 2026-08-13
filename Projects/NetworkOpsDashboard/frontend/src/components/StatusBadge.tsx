import type { DeviceStatus } from '../types'

export function StatusBadge({ status }: { status: DeviceStatus }) {
  return <span className={`badge ${status}`}>{status}</span>
}
