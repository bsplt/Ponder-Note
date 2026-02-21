import type { CSSProperties, KeyboardEventHandler, Ref } from 'react'

type TodoRowProps = {
  checked: boolean
  text: string
  onToggle: () => void
  focused?: boolean
  disabled?: boolean
  showOpenButton?: boolean
  onOpen?: () => void
  style?: CSSProperties
  className?: string
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
  tabIndex?: number
  role?: string
  ariaLabel?: string
  containerRef?: Ref<HTMLDivElement>
}

export function TodoRow(props: TodoRowProps) {
  const {
    checked,
    text,
    onToggle,
    focused = false,
    disabled = false,
    showOpenButton = false,
    onOpen,
    style,
    className,
    onKeyDown,
    tabIndex,
    role,
    ariaLabel,
    containerRef,
  } = props

  const classes = [
    'todoRow',
    focused ? 'todoRowFocused' : '',
    disabled ? 'todoRowDisabled' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={containerRef}
      className={classes}
      style={style}
      onClick={disabled ? undefined : onToggle}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      role={role}
      aria-label={ariaLabel}
      aria-checked={role === 'checkbox' ? checked : undefined}
      aria-disabled={disabled || undefined}
    >
      <span className="todoCheckbox">{checked ? '■' : ' '}</span>
      <span className={`todoText ${checked ? 'todoTextChecked' : ''}`}>{text}</span>
      {showOpenButton ? (
        <button
          type="button"
          className="todoOpenBtn"
          onClick={(event) => {
            event.stopPropagation()
            if (disabled) return
            onOpen?.()
          }}
          disabled={disabled}
        >
          →
        </button>
      ) : null}
    </div>
  )
}
