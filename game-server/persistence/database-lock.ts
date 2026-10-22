import { DatabaseSync } from 'node:sqlite'
import { realpathSync, existsSync } from 'node:fs'
import { dirname, resolve, basename, join } from 'node:path'

/** The in-memory simulation and state have exactly one writer per database. */
export function acquireDatabaseLock(dbPath: string): () => void {
  if (dbPath === ':memory:') return () => {}
  const absolute = resolve(dbPath)
  const canonical = existsSync(absolute)
    ? realpathSync(absolute)
    : join(realpathSync(dirname(absolute)), basename(absolute))
  // Keep this sidecar permanently. Unlinking a lock inode would allow two owners.
  // SQLite's OS lock is released even after SIGKILL, without stale-PID races.
  const lock = new DatabaseSync(`${canonical}.writer-lock`)
  try {
    lock.exec(
      'PRAGMA busy_timeout=0; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS owner (id INTEGER)',
    )
  } catch (error) {
    lock.close()
    throw new Error('Já existe uma instância do jogo usando este banco.', {
      cause: error,
    })
  }
  return () => lock.close()
}
