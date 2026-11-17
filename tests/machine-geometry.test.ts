import assert from 'node:assert/strict'
import test from 'node:test'
import { CoreMachine } from '../game-server/pipeline/machines/core-machine.ts'
import { Machine } from '../game-server/pipeline/machines/machine.ts'
import { Slot } from '../game-server/pipeline/machines/slot.ts'
import { SourceMachine } from '../game-server/pipeline/machines/source-machine.ts'

test('source is 3×3 with one output on the face-center neighbor', () => {
  const source = new SourceMachine('source', { x: 2, y: 4 }, 'east', 'circle', 4)
  assert.equal(source.width, 3)
  assert.equal(source.height, 3)
  assert.equal(source.outputSlots().length, 1)
  assert.deepEqual(source.outputSlots()[0]!.cell, { x: 5, y: 5 })
})

test('Machine rejects non-positive footprints', () => {
  class Probe extends Machine {
    readonly kind = 'probe'
  }
  assert.throws(() => new Probe('a', { x: 0, y: 0 }, 0, 1), /positive integer/)
  assert.throws(() => new Probe('a', { x: 0, y: 0 }, 1.5, 1), /positive integer/)
})

test('Machine rejects invalid input and output slots', () => {
  class Probe extends Machine {
    readonly kind = 'probe'
    tryAdd(slot: Slot) {
      this.addSlot(slot)
    }
  }
  const probe = new Probe('probe', { x: 0, y: 0 }, 3, 3)
  assert.throws(
    () => probe.tryAdd(new Slot('interior', 'input', { x: 1, y: 1 }, 'east')),
    /outer rim/,
  )
  assert.throws(
    () => probe.tryAdd(new Slot('inside-out', 'output', { x: 1, y: 1 }, 'east')),
    /outside the footprint/,
  )
  assert.throws(
    () => probe.tryAdd(new Slot('far', 'output', { x: 5, y: 1 }, 'east')),
    /attach to the rim/,
  )
})

test('slotBracket spans one cell and returns a closed polygon', () => {
  const core = new CoreMachine('core', { x: 0, y: 0 })
  const slot = core.slotAt({ x: 2, y: 0 }, 'input')
  assert.ok(slot)
  const path = core.slotBracket(slot, 48)
  assert.equal(path.length, 8)
  const xs = path.map((point) => point.x)
  const ys = path.map((point) => point.y)
  assert.equal(Math.min(...xs), 2 * 48)
  assert.equal(Math.max(...xs), 3 * 48)
  assert.ok(Math.min(...ys) < 0)
  assert.equal(Math.max(...ys), 0)
})
