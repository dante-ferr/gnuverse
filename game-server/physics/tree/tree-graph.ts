import type { TreeFrame, TreeNode } from '../tree-types.ts'

/** Consultas do grafo lógico da árvore. */
export class TreeGraph {
  frame: TreeFrame

  constructor(frame: TreeFrame) {
    this.frame = frame
  }

  node(id: string) {
    return this.frame.nodes.find((node) => node.id === id && !node.broken)
  }

  children(id: string) {
    return this.frame.nodes.filter((node) => node.parentId === id && !node.broken)
  }

  root() {
    return this.frame.nodes.find((node) => node.parentId === null && !node.broken)
  }

  segmentOrder() {
    const pending = this.frame.nodes.filter((node) => !node.broken && node.parentId)
    const ordered: TreeNode[] = []
    const placed = new Set<string>()
    const root = this.root()
    if (root) placed.add(root.id)
    let guard = 0
    while (pending.length && guard++ < pending.length + 2) {
      for (let index = 0; index < pending.length; ) {
        const node = pending[index]!
        if (node.parentId && placed.has(node.parentId)) {
          ordered.push(node)
          placed.add(node.id)
          pending.splice(index, 1)
        } else {
          index += 1
        }
      }
    }
    return ordered
  }

  segmentStart(parent: TreeNode, child: TreeNode) {
    return child.attach ?? { x: parent.x, y: parent.y }
  }
}
