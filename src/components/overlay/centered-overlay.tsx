'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './centered-overlay.module.css'

export type CenteredOverlayProps = {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
}

/** Centered modal dialog shell for reuse across the site. */
export function CenteredOverlay({
  title,
  onClose,
  children,
  closeLabel = 'Fechar',
}: CenteredOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.overlay}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        onClose()
      }}
    >
      <div className={styles.header}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose}>
          {closeLabel}
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </dialog>
  )
}
