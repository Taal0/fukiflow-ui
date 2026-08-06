/** Relative Turkish labels for SQLite `datetime('now')` style timestamps. */
export function formatRelativeTr(iso: string | null | undefined): string {
  if (!iso) return ''
  const raw = iso.includes('T') ? iso : iso.replace(' ', 'T')
  const withZ = /Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`
  const then = Date.parse(withZ)
  if (!Number.isFinite(then)) return ''
  const sec = Math.round((Date.now() - then) / 1000)
  if (sec < 45) return 'az önce'
  if (sec < 3600) {
    const m = Math.round(sec / 60)
    return `${m} dk önce`
  }
  if (sec < 86400) {
    const h = Math.round(sec / 3600)
    return `${h} saat önce`
  }
  const d = Math.round(sec / 86400)
  if (d < 30) return `${d} gün önce`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo} ay önce`
  const y = Math.round(mo / 12)
  return `${y} yıl önce`
}
