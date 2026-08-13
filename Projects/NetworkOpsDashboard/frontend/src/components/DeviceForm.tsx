import { useState, type FormEvent } from 'react'
import type { DeviceRequest, DeviceType } from '../types'

const DEVICE_TYPES: DeviceType[] = ['ROUTER', 'SWITCH', 'SERVER', 'FIREWALL', 'ACCESS_POINT']

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/

interface DeviceFormProps {
  initialValues?: DeviceRequest
  submitLabel: string
  onSubmit: (values: DeviceRequest) => Promise<void>
  onCancel: () => void
}

export function DeviceForm({ initialValues, submitLabel, onSubmit, onCancel }: DeviceFormProps) {
  const [hostname, setHostname] = useState(initialValues?.hostname ?? '')
  const [ipAddress, setIpAddress] = useState(initialValues?.ipAddress ?? '')
  const [deviceType, setDeviceType] = useState<DeviceType>(initialValues?.deviceType ?? 'ROUTER')
  const [location, setLocation] = useState(initialValues?.location ?? '')
  const [clientErrors, setClientErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const errors: string[] = []

    if (!hostname.trim()) {
      errors.push('Hostname is required')
    }
    if (!ipAddress.trim()) {
      errors.push('IP address is required')
    } else if (!IPV4_PATTERN.test(ipAddress.trim())) {
      errors.push('IP address must be a valid IPv4 address')
    }
    if (!location.trim()) {
      errors.push('Location is required')
    }

    setClientErrors(errors)
    if (errors.length > 0) {
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        hostname: hostname.trim(),
        ipAddress: ipAddress.trim(),
        deviceType,
        location: location.trim(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      {clientErrors.length > 0 && (
        <div className="alert error" role="alert" style={{ margin: '1rem 1.25rem 0' }}>
          <strong>Please fix the form</strong>
          <ul>
            {clientErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="hostname">Hostname</label>
          <input
            id="hostname"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="core-router-1"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="ipAddress">IP address</label>
          <input
            id="ipAddress"
            value={ipAddress}
            onChange={(event) => setIpAddress(event.target.value)}
            placeholder="10.0.0.1"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="deviceType">Device type</label>
          <select
            id="deviceType"
            value={deviceType}
            onChange={(event) => setDeviceType(event.target.value as DeviceType)}
          >
            {DEVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="DC1-RackA"
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
