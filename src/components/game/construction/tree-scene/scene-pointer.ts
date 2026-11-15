type Point = { x: number; y: number }

type DragState =
  | { kind: 'pending'; x: number; y: number; button: number }
  | { kind: 'pan'; lastX: number; lastY: number; button: number }
  | null

export type PointerMove =
  | { type: 'pinch'; sx: number; sy: number; zoom: number }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'preview' }
  | { type: 'none' }

/** Arraste, pinça e clique da cena, sem desenhar. */
export class ScenePointer {
  private drag: DragState = null
  private pointers = new Map<number, Point>()
  private pinch: { distance: number; zoom: number } | null = null

  down(id: number, x: number, y: number, button: number, zoom: number) {
    this.pointers.set(id, { x, y })
    if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()]
      this.pinch = {
        distance: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y),
        zoom,
      }
      this.drag = null
      return
    }
    if (button === 0 || button === 1) {
      this.drag = { kind: 'pending', x, y, button }
    }
  }

  move(
    id: number,
    x: number,
    y: number,
    rect: { left: number; top: number },
    dragThreshold: number,
    scale: number,
    clampZoom: (zoom: number) => number,
    growArmed: boolean,
  ): PointerMove {
    this.pointers.set(id, { x, y })
    if (this.pointers.size === 2 && this.pinch) {
      const pts = [...this.pointers.values()]
      const distance = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)
      return {
        type: 'pinch',
        sx: (pts[0]!.x + pts[1]!.x) / 2 - rect.left,
        sy: (pts[0]!.y + pts[1]!.y) / 2 - rect.top,
        zoom: clampZoom((this.pinch.zoom * distance) / this.pinch.distance),
      }
    }
    const drag = this.drag
    if (drag?.kind === 'pending') {
      const dist = Math.hypot(x - drag.x, y - drag.y)
      if (dist > dragThreshold && (drag.button === 0 || drag.button === 1)) {
        this.drag = { kind: 'pan', lastX: x, lastY: y, button: drag.button }
        return { type: 'pan', dx: 0, dy: 0 }
      }
    }
    if (this.drag?.kind === 'pan') {
      const pan = this.drag
      const dx = (x - pan.lastX) / scale
      const dy = (y - pan.lastY) / scale
      this.drag = { ...pan, lastX: x, lastY: y }
      return { type: 'pan', dx, dy }
    }
    if (growArmed) return { type: 'preview' }
    return { type: 'none' }
  }

  up(id: number): 'click' | 'pan' | 'ignore' {
    this.pointers.delete(id)
    if (this.pointers.size < 2) this.pinch = null
    const drag = this.drag
    this.drag = null
    if (drag?.kind === 'pan') return 'pan'
    if (drag?.kind === 'pending' && drag.button === 0) return 'click'
    return 'ignore'
  }

  cancel(id: number) {
    this.pointers.delete(id)
    if (this.pointers.size < 2) this.pinch = null
    this.drag = null
  }

  get panning() {
    return this.drag?.kind === 'pan'
  }
}
