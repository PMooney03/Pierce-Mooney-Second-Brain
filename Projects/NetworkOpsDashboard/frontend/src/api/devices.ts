import api from './client'
import type {
  Device,
  DeviceRequest,
  DeviceStatus,
  DeviceType,
  PageResponse,
  StatusCheck,
} from '../types'

export interface DeviceListParams {
  status?: DeviceStatus | ''
  deviceType?: DeviceType | ''
  page?: number
  size?: number
}

export async function listDevices(params: DeviceListParams = {}): Promise<PageResponse<Device>> {
  const { data } = await api.get<PageResponse<Device>>('/api/devices', {
    params: {
      status: params.status || undefined,
      deviceType: params.deviceType || undefined,
      page: params.page ?? 0,
      size: params.size ?? 20,
    },
  })
  return data
}

export async function getDevice(id: number): Promise<Device> {
  const { data } = await api.get<Device>(`/api/devices/${id}`)
  return data
}

export async function createDevice(payload: DeviceRequest): Promise<Device> {
  const { data } = await api.post<Device>('/api/devices', payload)
  return data
}

export async function updateDevice(id: number, payload: DeviceRequest): Promise<Device> {
  const { data } = await api.put<Device>(`/api/devices/${id}`, payload)
  return data
}

export async function deleteDevice(id: number): Promise<void> {
  await api.delete(`/api/devices/${id}`)
}

export async function getDeviceHistory(id: number, limit = 20): Promise<StatusCheck[]> {
  const { data } = await api.get<StatusCheck[]>(`/api/devices/${id}/history`, {
    params: { limit },
  })
  return data
}
