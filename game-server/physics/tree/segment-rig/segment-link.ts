import type Matter from 'matter-js'

/** Um galho rígido preso por uma junta ao pai. */
export class SegmentLink {
  nodeId: string
  parentId: string
  body: Matter.Body
  constraint: Matter.Constraint
  length: number
  angularVelocity = 0

  constructor(
    nodeId: string,
    parentId: string,
    body: Matter.Body,
    constraint: Matter.Constraint,
    length: number,
  ) {
    this.nodeId = nodeId
    this.parentId = parentId
    this.body = body
    this.constraint = constraint
    this.length = length
  }

  pose() {
    const cosine = Math.cos(this.body.angle)
    const sine = Math.sin(this.body.angle)
    const half = this.length / 2
    return {
      attachX: this.body.position.x - cosine * half,
      attachY: this.body.position.y - sine * half,
      x: this.body.position.x + cosine * half,
      y: this.body.position.y + sine * half,
    }
  }

}
