import { randomUUID } from 'node:crypto'
import { loadGameConfig, type TreeRules } from '../../config/load-game-config.ts'
import { groundLimitAt, verifyAnchorOnSegment } from '../map-gen.ts'
import type { GrowInput, TreeActionResult, TreeNode } from '../tree-types.ts'
import type { TreeGraph } from './tree-graph.ts'

/** Regras de crescimento, folha, fortificação, poda e raiz secundária. */
export class BranchActions {
  private graph: TreeGraph
  private tree: TreeRules

  constructor(graph: TreeGraph, tree: TreeRules) {
    this.graph = graph
    this.tree = tree
  }

  grow(input: GrowInput): TreeActionResult {
    const check = this.validateGrow(input)
    if (!check.ok) return check
    const node: TreeNode = {
      id: randomUUID(),
      x: input.x,
      y: input.y,
      parentId: input.segmentId,
      authorId: input.authorId,
      authorName: input.authorName,
      leaf: false,
      fortified: false,
      secondaryRoot: false,
      attach: { x: input.anchorX, y: input.anchorY },
    }
    this.graph.frame.nodes.push(node)
    return { ok: true, nodeId: node.id }
  }

  placeLeaf(nodeId: string): TreeActionResult {
    const node = this.graph.node(nodeId)
    if (!node) return { ok: false, error: 'Nó inválido.' }
    if (node.leaf) return { ok: false, error: 'Folha já existe.' }
    node.leaf = true
    return { ok: true }
  }

  fortify(nodeId: string): TreeActionResult {
    const node = this.graph.node(nodeId)
    if (!node) return { ok: false, error: 'Nó inválido.' }
    if (node.parentId === null) return { ok: false, error: 'Raiz já é fortificada.' }
    if (node.fortified) return { ok: false, error: 'Já fortificado.' }
    node.fortified = true
    return { ok: true }
  }

  prune(nodeId: string): TreeActionResult {
    const node = this.graph.node(nodeId)
    if (!node) return { ok: false, error: 'Nó inválido.' }
    if (node.parentId === null) return { ok: false, error: 'Não pode podar a raiz.' }
    if (this.graph.children(nodeId).length) return { ok: false, error: 'Só galhos sem descendentes.' }
    const index = this.graph.frame.nodes.findIndex((item) => item.id === nodeId)
    if (index >= 0) this.graph.frame.nodes.splice(index, 1)
    return { ok: true }
  }

  secondaryRoot(parentId: string, x: number, y: number): TreeActionResult {
    const parent = this.graph.node(parentId)
    if (!parent) return { ok: false, error: 'Nó inválido.' }
    if (y <= parent.y + this.tree.minUpwardDelta)
      return { ok: false, error: 'Raiz secundária só para baixo.' }
    if (y >= groundLimitAt(x, this.graph.frame, this.tree))
      return { ok: false, error: 'Deve alcançar o chão.' }
    const count = this.graph.frame.nodes.filter((node) => node.secondaryRoot && !node.broken).length
    if (count >= this.tree.maxSecondaryRoots)
      return { ok: false, error: 'Limite de raízes secundárias.' }
    const length = Math.hypot(parent.x - x, parent.y - y)
    if (length > this.tree.lMax) return { ok: false, error: 'Segmento longo demais.' }
    const node: TreeNode = {
      id: randomUUID(),
      x,
      y,
      parentId,
      authorId: parent.authorId,
      authorName: parent.authorName,
      leaf: false,
      fortified: true,
      secondaryRoot: true,
    }
    this.graph.frame.nodes.push(node)
    return { ok: true, nodeId: node.id }
  }

  witherPeripheral() {
    let changed = true
    while (changed) {
      changed = false
      for (const node of [...this.graph.frame.nodes]) {
        if (node.broken || node.parentId === null || node.fortified) continue
        if (this.graph.children(node.id).length) continue
        const index = this.graph.frame.nodes.findIndex((item) => item.id === node.id)
        if (index >= 0) {
          this.graph.frame.nodes.splice(index, 1)
          changed = true
        }
      }
    }
  }

  private validateGrow(input: GrowInput): TreeActionResult {
    const anchorCheck = verifyAnchorOnSegment(
      this.graph.frame,
      input.segmentId,
      input.anchorX,
      input.anchorY,
      this.tree,
    )
    if (!anchorCheck.ok) return anchorCheck
    const parent = this.graph.node(input.segmentId)
    if (!parent) return { ok: false, error: 'Segmento inválido.' }
    const groundY = groundLimitAt(input.x, this.graph.frame, this.tree)
    if (input.y >= groundY) return { ok: false, error: 'Falta distância do chão.' }
    if (input.anchorY - input.y < this.tree.minUpwardDelta)
      return { ok: false, error: 'O galho deve crescer para cima.' }
    const length = Math.hypot(input.anchorX - input.x, input.anchorY - input.y)
    if (length > this.tree.lMax) return { ok: false, error: 'Segmento longo demais.' }
    if (length < this.tree.minSegmentLength)
      return { ok: false, error: 'Segmento curto demais.' }
    const margin = this.tree.worldMargin
    if (input.x < margin || input.x > this.tree.worldWidth - margin || input.y < margin)
      return { ok: false, error: 'Fora da caverna.' }
    if (this.graph.frame.nodes.filter((node) => !node.broken).length >= loadGameConfig().rules.maxSegments)
      return { ok: false, error: 'Limite de galhos.' }
    return { ok: true }
  }
}
