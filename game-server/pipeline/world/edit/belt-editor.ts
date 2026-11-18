import { cellKey } from '../../geometry/cell.ts'
import { ahead, type Direction } from '../../geometry/direction.ts'
import { BeltMachine } from '../../machines/belt-machine.ts'
import type { Match } from '../match.ts'
import { MERGE_INPUT_MAX, allInboundBelts } from '../tick/merge.ts'

type Author = { id: string; nickname: string }
type Stroke = { x: number; y: number; direction: Direction }

/** Adds and removes belts. */
export class BeltEditor {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  place(cells: Stroke[], author: Author) {
    if (cells.length === 0) return 'Escolha ao menos uma célula.'
    const allowed: Stroke[] = []
    for (const cell of cells) {
      if (this.onMachine(cell)) continue
      const error = this.validate(cell, author, allowed)
      if (error) return error
      allowed.push(cell)
    }
    if (allowed.length === 0) return 'Essa célula pertence a uma máquina.'
    for (const cell of allowed) this.write(cell, author)
    this.match.noteCollaborator(author)
    return null
  }

  remove(cell: { x: number; y: number }, author: Author) {
    const belt = this.match.beltAt(cell)
    if (!belt) return 'Não há esteira nessa célula.'
    if (belt.authorId !== author.id) return 'Essa esteira é de outra pessoa.'
    this.match.belts = this.match.belts.filter((item) => item !== belt)
    this.match.packets = this.match.packets.filter(
      (packet) => cellKey(packet.cell) !== cellKey(cell),
    )
    return null
  }

  private onMachine(cell: { x: number; y: number }) {
    if (this.match.core.covers(cell)) return true
    return this.match.sources.some((source) => source.covers(cell))
  }

  private validate(cell: Stroke, author: Author, pending: Stroke[]) {
    if (!this.match.inBounds(cell)) return 'Fora do mapa.'
    if (!this.match.isOwnedCell(cell)) return 'Área ainda não liberada.'
    const belt = this.match.beltAt(cell)
    if (belt && belt.authorId !== author.id) return 'Essa esteira é de outra pessoa.'
    if (this.mergeInputCount(cell, pending) >= MERGE_INPUT_MAX)
      return 'No máximo 3 esteiras podem apontar para a mesma célula.'
    return null
  }

  /** Existing + pending inbounds into the cell this stroke entry points at. */
  private mergeInputCount(cell: Stroke, pending: Stroke[]) {
    const dest = ahead(cell.x, cell.y, cell.direction)
    const destKey = cellKey(dest)
    const fromKey = cellKey(cell)
    const existing = allInboundBelts(this.match, dest).filter(
      (belt) => cellKey(belt.origin) !== fromKey,
    )
    const pendingKeys = new Set(
      pending
        .filter((stroke) => {
          if (cellKey(stroke) === fromKey) return false
          const tip = ahead(stroke.x, stroke.y, stroke.direction)
          return cellKey(tip) === destKey
        })
        .map((stroke) => cellKey(stroke)),
    )
    // Pending may replace an existing inbound on the same origin cell.
    const keptExisting = existing.filter((belt) => !pendingKeys.has(cellKey(belt.origin))).length
    return keptExisting + pendingKeys.size
  }

  private write(cell: Stroke, author: Author) {
    const key = cellKey(cell)
    this.match.belts = this.match.belts.filter((belt) => cellKey(belt.origin) !== key)
    this.match.packets = this.match.packets.filter((packet) => cellKey(packet.cell) !== key)
    const placedAt = this.match.nextBeltSeq++
    this.match.belts.push(
      new BeltMachine(`b${placedAt}`, { x: cell.x, y: cell.y }, cell.direction, {
        id: author.id,
        nickname: author.nickname,
        placedAt,
      }),
    )
  }
}