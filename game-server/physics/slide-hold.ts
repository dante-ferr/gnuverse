import Matter from 'matter-js'

/** Shallowest incline that must hold under a horizontal wind of one gravity. */
export const HOLD_INCLINATION_RADIANS = 7 * Math.PI / 180

const holdSine = Math.sin(HOLD_INCLINATION_RADIANS)
const holdCosine = Math.cos(HOLD_INCLINATION_RADIANS)

/**
 * Coulomb coefficient that balances gravity and a full-gravity horizontal wind
 * on a 7° incline: (sin 7° + cos 7°) / (cos 7° - sin 7°).
 * Any shallower incline needs a smaller coefficient, for every wind up to one gravity.
 */
export const HOLD_FRICTION = (holdSine + holdCosine) / (holdCosine - holdSine)

export type PlaneAcceleration = { x: number; y: number }

/** Friction a resting contact needs so windRatio·g down the slope does not slide it. */
export function requiredFriction(inclination: number, windRatio: number): number {
  const sine = Math.sin(inclination)
  const cosine = Math.cos(inclination)
  const support = cosine - windRatio * sine
  if (support <= 0) return Number.POSITIVE_INFINITY
  return (windRatio * cosine + sine) / support
}

/** Whether μ sized for 7° and maximum wind keeps this acceleration from sliding. */
export function holdsContact(normal: PlaneAcceleration, acceleration: PlaneAcceleration): boolean {
  const { into, tangent } = contactAxes(normal, acceleration)
  return keepsHold(into, tangent)
}

type Pose = { x: number; y: number; angle: number }

/**
 * Cancels tangential slip on contacts that Coulomb friction holds.
 * Matter's resolver drops static friction when the resting overlap is smaller
 * than the substep velocity, so the hold is applied to the contact directly.
 */
export function holdRestingContacts(
  pairs: readonly Matter.Pair[],
  poses: ReadonlyMap<number, Pose>,
  acceleration: PlaneAcceleration,
): void {
  for (const pair of pairs) {
    if (!pair.isActive || pair.isSensor) continue
    const bodyA = pair.collision.parentA
    const bodyB = pair.collision.parentB
    if (!bodyA.isStatic && !bodyB.isStatic) continue
    const axes = contactAxes(pair.collision.normal, acceleration)
    if (!keepsHold(axes.into, axes.tangent)) continue
    const vertices = contactVertices(pair)
    if (vertices.length === 0) continue
    const inverseA = bodyA.isStatic ? 0 : bodyA.inverseMass
    const inverseB = bodyB.isStatic ? 0 : bodyB.inverseMass
    const inverse = inverseA + inverseB
    if (inverse === 0) continue
    let slip = 0
    let tangentSpeed = 0
    for (const vertex of vertices) {
      const point = vertex
      const movedA = displacement(bodyA, poses.get(bodyA.id), point)
      const movedB = displacement(bodyB, poses.get(bodyB.id), point)
      slip += (movedA.x - movedB.x) * axes.tangentX + (movedA.y - movedB.y) * axes.tangentY
      tangentSpeed += pointSpeed(bodyA, point, axes) - pointSpeed(bodyB, point, axes)
    }
    slip /= vertices.length
    tangentSpeed /= vertices.length
    const shareA = inverseA / inverse
    const shareB = inverseB / inverse
    if (slip !== 0) {
      translate(bodyA, -slip * shareA * axes.tangentX, -slip * shareA * axes.tangentY)
      translate(bodyB, slip * shareB * axes.tangentX, slip * shareB * axes.tangentY)
    }
    if (tangentSpeed !== 0) {
      // Linear correction only: pinning the contact keeps the angular velocity
      // Matter already solved, so a tower can still rotate over its leeward edge.
      const impulse = -tangentSpeed / inverse
      addVelocity(bodyA, impulse * inverseA * axes.tangentX, impulse * inverseA * axes.tangentY)
      addVelocity(bodyB, -impulse * inverseB * axes.tangentX, -impulse * inverseB * axes.tangentY)
    }
  }
}

function keepsHold(into: number, tangent: number): boolean {
  return into > 0 && Math.abs(tangent) <= HOLD_FRICTION * into
}

function contactAxes(normal: PlaneAcceleration, acceleration: PlaneAcceleration) {
  const upward = normal.y > 0 ? -1 : 1
  const length = Math.hypot(normal.x, normal.y) || 1
  const x = upward * normal.x / length
  const y = upward * normal.y / length
  return {
    into: -(acceleration.x * x + acceleration.y * y),
    tangent: -y * acceleration.x + x * acceleration.y,
    tangentX: -y,
    tangentY: x,
  }
}

function contactVertices(pair: Matter.Pair): Matter.Vertex[] {
  const count = (pair as Matter.Pair & { contactCount: number }).contactCount
  const vertices: Matter.Vertex[] = []
  for (let index = 0; index < count; index += 1) {
    const vertex = pair.contacts[index]?.vertex
    if (vertex) vertices.push(vertex)
  }
  return vertices
}

function displacement(body: Matter.Body, pose: Pose | undefined, point: Matter.Vector) {
  if (!pose) return { x: 0, y: 0 }
  const offsetX = point.x - body.position.x
  const offsetY = point.y - body.position.y
  const angle = body.angle - pose.angle
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const previousX = pose.x + offsetX * cosine + offsetY * sine
  const previousY = pose.y - offsetX * sine + offsetY * cosine
  return { x: point.x - previousX, y: point.y - previousY }
}

function pointSpeed(
  body: Matter.Body,
  point: Matter.Vector,
  axes: { tangentX: number; tangentY: number },
) {
  if (body.isStatic) return 0
  const velocity = Matter.Body.getVelocity(body)
  const angular = Matter.Body.getAngularVelocity(body)
  const offsetX = point.x - body.position.x
  const offsetY = point.y - body.position.y
  const speedX = velocity.x - angular * offsetY
  const speedY = velocity.y + angular * offsetX
  return speedX * axes.tangentX + speedY * axes.tangentY
}

function translate(body: Matter.Body, x: number, y: number) {
  if (body.isStatic || (x === 0 && y === 0)) return
  Matter.Body.setPosition(body, { x: body.position.x + x, y: body.position.y + y })
}

function addVelocity(body: Matter.Body, x: number, y: number) {
  if (body.isStatic || (x === 0 && y === 0)) return
  const velocity = Matter.Body.getVelocity(body)
  Matter.Body.setVelocity(body, { x: velocity.x + x, y: velocity.y + y })
}
