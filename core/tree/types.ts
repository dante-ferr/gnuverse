export type TreeNodeLite = {
  id: string
  x: number
  y: number
  parentId: string | null
  broken?: boolean
  attach?: { x: number; y: number }
}