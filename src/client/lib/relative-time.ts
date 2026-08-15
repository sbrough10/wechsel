const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function timeAgo(epochMs: number, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - epochMs)
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  return `${Math.floor(elapsed / DAY)}d ago`
}

export function timeAgoShort(epochMs: number, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - epochMs)
  if (elapsed < MINUTE) return `${Math.floor(elapsed / 1000)}s ago`
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  return `${Math.floor(elapsed / DAY)}d ago`
}
