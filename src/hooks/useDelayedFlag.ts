import { useEffect, useState } from 'react'

/** Become true only after `active` has stayed true for `delayMs`. */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!active) {
      setShown(false)
      return
    }
    const id = window.setTimeout(() => setShown(true), delayMs)
    return () => window.clearTimeout(id)
  }, [active, delayMs])

  return shown
}
