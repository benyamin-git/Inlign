import { useEffect, useState } from 'react'

export function useIsNarrow(maxWidthPx = 640): boolean {
  const query = `(max-width: ${maxWidthPx}px)`
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return narrow
}
