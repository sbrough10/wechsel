const KEY = 'wechsel.memberId'

export function getStoredMemberId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function storeMemberId(id: string): void {
  localStorage.setItem(KEY, id)
}

export function clearStoredMemberId(): void {
  localStorage.removeItem(KEY)
}
