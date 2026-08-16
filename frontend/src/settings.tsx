import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const THEME_KEY = 'secondbrain.theme'
const MAP_KEEP_KEY = 'secondbrain.mapKeep'

export type ThemeMode = 'light' | 'dark'

type SettingsContextValue = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  mapKeep: boolean
  setMapKeep: (keep: boolean) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function readTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function readMapKeep(): boolean {
  const stored = localStorage.getItem(MAP_KEEP_KEY)
  if (stored === '1' || stored === 'true') return true
  if (stored === '0' || stored === 'false') return false
  // Default FADE — KEEP stays available in Settings
  return false
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'light' : readTheme(),
  )
  const [mapKeep, setMapKeepState] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readMapKeep(),
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(MAP_KEEP_KEY, mapKeep ? '1' : '0')
  }, [mapKeep])

  const value = useMemo<SettingsContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
      mapKeep,
      setMapKeep: setMapKeepState,
    }),
    [theme, mapKeep],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
