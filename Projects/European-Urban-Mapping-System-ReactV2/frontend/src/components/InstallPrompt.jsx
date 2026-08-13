import { useEffect, useState } from 'react'
import { isIosSafari, isStandalonePwa } from '../utils/pwa'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalonePwa()) return

    const onInstall = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', onInstall)
    return () => window.removeEventListener('beforeinstallprompt', onInstall)
  }, [])

  useEffect(() => {
    if (isStandalonePwa() || dismissed) return
    if (isIosSafari() && !deferredPrompt) {
      setShowIosHint(true)
    }
  }, [deferredPrompt, dismissed])

  if (isStandalonePwa() || dismissed) return null

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setDismissed(true)
  }

  if (deferredPrompt) {
    return (
      <button
        type="button"
        id="install-btn"
        className="install-btn"
        onClick={handleInstall}
      >
        📲 Install app
      </button>
    )
  }

  if (showIosHint) {
    return (
      <button
        type="button"
        id="install-btn"
        className="install-btn install-btn-ios"
        onClick={() => setDismissed(true)}
        title="Tap Share, then Add to Home Screen"
      >
        📲 Add to Home Screen
      </button>
    )
  }

  return null
}
