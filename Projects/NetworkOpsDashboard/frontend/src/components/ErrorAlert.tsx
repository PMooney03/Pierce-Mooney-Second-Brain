import { ApiError } from '../api/client'

export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) {
    return null
  }

  const apiError = error instanceof ApiError ? error : null
  const message = apiError?.message ?? (error instanceof Error ? error.message : 'Something went wrong')
  const details = apiError?.details ?? []

  return (
    <div className="alert error" role="alert">
      <strong>{message}</strong>
      {details.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
