import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: {
    'Content-Type': 'application/json',
  },
})

export class ApiError extends Error {
  status: number
  details: string[]

  constructor(message: string, status: number, details: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>
    const status = axiosError.response?.status ?? 0
    const body = axiosError.response?.data
    return new ApiError(
      body?.message ?? axiosError.message ?? 'Request failed',
      status,
      body?.details ?? [],
    )
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 0)
  }

  return new ApiError('Unexpected error', 0)
}

export default api
