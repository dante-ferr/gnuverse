import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { State } from '../domain/types.ts'
import { acquireDatabaseLock } from './database-lock.ts'
const freshState = (): State => ({ users: {}, sessions: {}, towers: {} })

export class GameStore {
  state: State
  private db: DatabaseSync
  private save: StatementSync
  private releaseLock: () => void
  onRollback: () => void = () => {}

  constructor(dbPath: string) {
    if (dbPath !== ':memory:')
      mkdirSync(dirname(resolve(dbPath)), { recursive: true })
    this.releaseLock = acquireDatabaseLock(dbPath)
    let db: DatabaseSync
    try {
      db = new DatabaseSync(dbPath)
    } catch (error) {
      this.releaseLock()
      throw error
    }
    try {
      db.exec(
        'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS game_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)',
      )
    } catch (error) {
      db.close()
      this.releaseLock()
      throw error
    }
    this.db = db
    const saved = db.prepare('SELECT value FROM game_state WHERE id=1').get()
    this.state = saved ? JSON.parse(saved.value as string) : freshState()
    for (const tower of Object.values(this.state.towers))
      tower.allowCreatorBan = tower.allowCreatorBan === true
    this.save = db.prepare(
      'INSERT INTO game_state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
    )
  }
  persist() {
    this.save.run(JSON.stringify(this.state))
  }
  atomic<T>(fn: () => T): T {
    const previous = JSON.stringify(this.state)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.persist()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      this.state = JSON.parse(previous)
      this.onRollback()
      throw error
    }
  }
  close() {
    try {
      this.db.close()
    } finally {
      this.releaseLock()
    }
  }
}
