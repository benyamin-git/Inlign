import { useEffect, useState } from 'react'
import { ensureSeeded } from '@/data/seed'
import { AppShell } from '@/features/shell/AppShell'
import { SettingsSheet } from '@/features/settings/SettingsSheet'
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

  return (
    <I18nProvider>
      {ready ? (
        <AppShell
          settingsSheet={(state) => (
            <SettingsSheet
              open={state.open}
              onClose={state.onClose}
              notebook={state.notebook}
              onNotebookImported={state.onNotebookImported}
            />
          )}
        />
      ) : null}
    </I18nProvider>
  )
}
