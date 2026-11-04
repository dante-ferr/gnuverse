import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, openSync, closeSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { authorizationFilePath, parseRoleEntries, type RoleEntry } from './file-role-store.ts'

export class RoleManagementError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export type RoleRegistry = { entries: RoleEntry[]; revision: string; enabled: boolean }
export function readRoleRegistry(path = authorizationFilePath()): RoleRegistry {
  let source: string
  try { source = readFileSync(path, 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !process.env.GNUVERSE_AUTHZ_FILE)
      return { entries: [], revision: '', enabled: false }
    throw error
  }
  return { entries: parseRoleEntries(source), revision: createHash('sha256').update(source).digest('hex'), enabled: true }
}

/** Serialize writers and publish complete registries atomically. Policy remains storage independent. */
export function updateRoleRegistry(
  revision: string,
  change: (entries: RoleEntry[], enabled: boolean) => RoleEntry[],
  path = authorizationFilePath(),
): RoleRegistry {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  let lock: number
  try { lock = openSync(`${path}.lock`, 'wx', 0o600) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new RoleManagementError(409, 'Outra alteração está sendo salva. Recarregue e tente novamente.')
    throw error
  }
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const current = readRoleRegistry(path)
    if (current.revision !== revision) throw new RoleManagementError(409, 'Os acessos foram alterados em outra sessão. Recarregue a lista antes de salvar.')
    let entries: RoleEntry[]
    try { entries = parseRoleEntries(JSON.stringify(change(current.entries, current.enabled))) }
    catch (error) {
      if (error instanceof RoleManagementError) throw error
      throw new RoleManagementError(400, 'Papéis ou vínculos inválidos. Uma conta só pode estar vinculada a uma pessoa.')
    }
    writeFileSync(temporary, `${JSON.stringify(entries, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    renameSync(temporary, path)
    return readRoleRegistry(path)
  } finally {
    try { unlinkSync(temporary) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    closeSync(lock)
    unlinkSync(`${path}.lock`)
  }
}
