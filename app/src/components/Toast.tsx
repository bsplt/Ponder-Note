import { useEffect } from 'react'

type ToastProps = {
  message: string
  onClose: () => void
  durationMs?: number
}

export function Toast(props: ToastProps) {
  useEffect(() => {
    const t = window.setTimeout(props.onClose, props.durationMs ?? 1400)
    return () => window.clearTimeout(t)
  }, [props.durationMs, props.message, props.onClose])

  return (
    <div className="toast" role="status" aria-live="polite">
      {props.message}
    </div>
  )
}
