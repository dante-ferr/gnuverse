import type { PipelineFrame } from './model/frame'
import styles from '../game-shell.module.css'

function letterAvatar(nickname: string) {
  const trimmed = nickname.trim()
  return (trimmed ? trimmed[0] : '?').toUpperCase()
}

type Props = {
  collaborators: PipelineFrame['collaborators']
}

/** Compact list of unique collaborators currently in the match frame. */
export function RoomCollaborators({ collaborators }: Props) {
  return (
    <section className={styles.sidebarBlock} aria-labelledby="room-collaborators-heading">
      <h2 id="room-collaborators-heading" className={styles.sidebarSectionTitle}>
        Colaboradores
      </h2>
      {collaborators.length === 0 ? (
        <p className={styles.controlsHint}>Ninguém na sala ainda.</p>
      ) : (
        <ul className={styles.roomCollaboratorList}>
          {collaborators.map((person) => (
            <li key={person.id} className={styles.roomCollaboratorItem}>
              <span className={styles.avatar} aria-hidden>
                {letterAvatar(person.nickname)}
              </span>
              <span className={styles.roomCollaboratorName}>{person.nickname}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}