import { APP_VERSION } from '@/lib/version'

export function AppRoot() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Inlign</h1>
        <p className="mt-2 text-sm">v{APP_VERSION}</p>
      </div>
    </main>
  )
}
