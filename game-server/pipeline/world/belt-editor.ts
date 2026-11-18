import { cellKey } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'
import { BeltMachine } from '../machines/belt-machine.ts'
import type { Match } from './match.ts'

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
      const error = this.validate(cell, author)
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
    return this.match.core.covers(cell) || this.match.source.covers(cell)
  }

  private validate(cell: Stroke, author: Author) {
    if (!this.match.inBounds(cell)) return 'Fora do mapa.'
    const belt = this.match.beltAt(cell)
    if (belt && belt.authorId !== author.id) return 'Essa esteira é de outra pessoa.'
    return null
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
