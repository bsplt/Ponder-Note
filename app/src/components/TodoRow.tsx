import type { CSSProperties } from 'react'

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
    <div className={classes} style={style} onClick={disabled ? undefined : onToggle}>
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
