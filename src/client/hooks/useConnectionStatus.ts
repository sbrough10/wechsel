import { useEffect, useState } from 'react'

interface FreshnessSignals {
  dataUpdatedAt: number
  fetchStatus: 'fetching' | 'paused' | 'idle'
  failureCount: number
}

export function useConnectionStatus(query: FreshnessSignals): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [connected, setConnected] = useState(true)
  const [lastDataUpdatedAt, setLastDataUpdatedAt] = useState(query.dataUpdatedAt)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (query.dataUpdatedAt !== lastDataUpdatedAt) {
    setLastDataUpdatedAt(query.dataUpdatedAt)
    setConnected(true)
  } else if (connected && (!online || query.fetchStatus === 'paused' || query.failureCount > 0)) {
    setConnected(false)
  }

  return connected
}
