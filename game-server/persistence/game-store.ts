import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Pool } from 'pg'
import type { State } from '../domain/types.ts'
import { acquireDatabaseLock } from './database-lock.ts'

export type PostgresPoolLike = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<{ value?: string }> }>
  end: () => Promise<void>
}

function normalizeState(saved: Partial<State> & { towers?: State['rooms'] } | undefined): State {
  // Legacy key from pre-pipeline saves (rooms were stored as `towers`).
  // Sessions belong to the identity issuer; stored hashes confer no access.
  return {
    users: saved?.users ?? {},
    sessions: {},
    rooms: saved?.rooms ?? saved?.towers ?? {},
  }
}

function normalizeLoadedRooms(state: State) {
  for (const room of Object.values(state.rooms)) {
    room.allowCreatorBan = room.allowCreatorBan === true
    room.chat ??= []
  }
}

function shouldUsePostgresSSL(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString)
    const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase()
    if (sslMode === 'disable') return false
    if (sslMode) return true
    return !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

export class GameStore {
  state: State
  private db: DatabaseSync | null = null
  private save: StatementSync | null = null
  private releaseLock: () => void = () => {}
  private pool: PostgresPoolLike | null = null
  private pendingSnapshot: string | null = null
  private flushing: Promise<void> | null = null
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
    this.state = normalizeState(saved ? JSON.parse(saved.value as string) : undefined)
    normalizeLoadedRooms(this.state)
    this.save = db.prepare(
      'INSERT INTO game_state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
    )
  }

  private static createFromPostgres(pool: PostgresPoolLike, initialState: State): GameStore {
    const store = Object.create(GameStore.prototype) as GameStore
    store.db = null
    store.save = null
    store.releaseLock = () => {}
    store.pool = pool
    store.pendingSnapshot = null
    store.flushing = null
    store.onRollback = () => {}
    store.state = initialState
    normalizeLoadedRooms(store.state)
    return store
  }

  static async openPostgres(connectionString: string): Promise<GameStore> {
    const pool = new Pool({
      connectionString,
      max: 3,
      ...(shouldUsePostgresSSL(connectionString)
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    })
    try {
      return await GameStore.fromPostgresPool(pool)
    } catch (error) {
      await pool.end().catch(() => {})
      throw error
    }
  }

  static async fromPostgresPool(pool: PostgresPoolLike): Promise<GameStore> {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS game_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)',
    )
    const result = await pool.query('SELECT value FROM game_state WHERE id=1')
    const raw = result.rows[0]?.value
    const initialState = normalizeState(raw ? JSON.parse(raw) : undefined)
    return GameStore.createFromPostgres(pool, initialState)
  }

  private async flushLoop(): Promise<void> {
    try {
      while (this.pendingSnapshot !== null && this.pool) {
        const snapshot = this.pendingSnapshot
        this.pendingSnapshot = null
        await this.pool.query(
          'INSERT INTO game_state(id,value) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
          [snapshot],
        )
      }
    } catch (error) {
      console.error('Failed to persist game state to Postgres:', error)
    } finally {
      this.flushing = null
      if (this.pendingSnapshot !== null && this.pool) {
        this.flushing = this.flushLoop()
      }
    }
  }

  async flush(): Promise<void> {
    while (this.flushing) {
      await this.flushing
    }
  }

  persist() {
    const snapshot = JSON.stringify(this.state)
    if (this.save) {
      this.save.run(snapshot)
      return
    }
    if (this.pool) {
      this.pendingSnapshot = snapshot
      if (!this.flushing) {
        this.flushing = this.flushLoop()
      }
    }
  }

  atomic<T>(fn: () => T): T {
    const previous = JSON.stringify(this.state)
    if (this.db) this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.persist()
      if (this.db) this.db.exec('COMMIT')
      return result
    } catch (error) {
      if (this.db) this.db.exec('ROLLBACK')
      this.state = JSON.parse(previous)
      this.onRollback()
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close()
      } finally {
        this.releaseLock()
      }
      return
    }
    if (this.pool) {
      await this.flush()
      await this.pool.end()
    }
  }
}