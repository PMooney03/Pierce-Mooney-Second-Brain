export type DeviceType = 'ROUTER' | 'SWITCH' | 'SERVER' | 'FIREWALL' | 'ACCESS_POINT'

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN'

export interface Device {
  id: number
  hostname: string
  ipAddress: string
  deviceType: DeviceType
  location: string
  status: DeviceStatus
  responseTimeMs: number | null
  lastCheckedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DeviceRequest {
  hostname: string
  ipAddress: string
  deviceType: DeviceType
  location: string
}

export interface StatusCheck {
  id: number
  deviceId: number
  status: DeviceStatus
  responseTimeMs: number | null
  checkedAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface DashboardSummary {
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  degradedDevices: number
  averageResponseTimeMs: number | null
}

export interface ApiErrorBody {
  timestamp?: string
  status?: number
  error?: string
  message?: string
  path?: string
  details?: string[]
}
