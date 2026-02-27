import { useEffect, useCallback, useRef } from 'react'

export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted'
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        permissionRef.current = permission
      })
    }
  }, [])

  const notify = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (permissionRef.current !== 'granted') return
    if (!document.hidden) return

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
    })

    setTimeout(() => notification.close(), 5000)

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }, [])

  return { notify }
}
