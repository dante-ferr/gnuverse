import styles from './game-shell.module.css'

/** Small inline coin glyph that inherits the surrounding text color. */
export function CoinIcon() {
  return (
    <svg
      className={styles.coinIcon}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
    >
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3" fill="currentColor" />
    </svg>
  )
}
