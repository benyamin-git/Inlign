import { useEffect, useState } from 'react'
import { ensureSeeded } from '@/data/seed'
import { AppShell } from '@/features/shell/AppShell'
import { I18nProvider } from '@/i18n/I18nProvider'

export function AppRoot() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void ensureSeeded()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <I18nProvider>{ready ? <AppShell /> : null}</I18nProvider>
}
