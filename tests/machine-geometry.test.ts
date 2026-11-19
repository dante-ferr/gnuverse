import assert from 'node:assert/strict'
import test from 'node:test'
import { CoreMachine } from '../game-server/pipeline/machines/core-machine.ts'
import { defaultSlotBracketStyle, Machine } from '../game-server/pipeline/machines/machine.ts'
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

test('slotBracket uses shallower input depth and deeper output depth', () => {
  const cellPx = 100
  const core = new CoreMachine('core', { x: 0, y: 0 })
  const input = core.slotAt({ x: 2, y: 0 }, 'input')
  assert.ok(input)
  const inPath = core.slotBracket(input, cellPx)
  const inputProtrusion = 0 - Math.min(...inPath.map((point) => point.y))
  assert.equal(
    inputProtrusion,
    (defaultSlotBracketStyle.inputDepthPercent / 100) * cellPx,
  )

  const source = new SourceMachine('source', { x: 0, y: 0 }, 'east', 'circle', 4)
  const output = source.outputSlots()[0]!
  const outPath = source.slotBracket(output, cellPx)
  const outputProtrusion =
    Math.max(...outPath.map((point) => point.x)) - output.cell.x * cellPx
  assert.equal(
    outputProtrusion,
    (defaultSlotBracketStyle.outputDepthPercent / 100) * cellPx,
  )
  assert.ok(outputProtrusion > inputProtrusion)
})

test('source output slotBracket back edge insets into the footprint', () => {
  const cellPx = 100
  const source = new SourceMachine('source', { x: 0, y: 0 }, 'east', 'circle', 4)
  const output = source.outputSlots()[0]!
  const outPath = source.slotBracket(output, cellPx)
  const rimX = output.cell.x * cellPx
  const expectedInset = (SourceMachine.outputBracketInsetPercent / 100) * cellPx
  const backXs = outPath
    .filter((point) => point.y === output.cell.y * cellPx || point.y === (output.cell.y + 1) * cellPx)
    .map((point) => point.x)
  assert.ok(backXs.length >= 2)
  assert.equal(Math.min(...backXs), rimX - expectedInset)
})

test('output slotBracket spine chevron points along slot travel', () => {
  const cellPx = 100
  const source = new SourceMachine('source', { x: 0, y: 0 }, 'east', 'circle', 4)
  const output = source.outputSlots()[0]!
  const outPath = source.slotBracket(output, cellPx)
  const outSpineX = output.cell.x * cellPx + (defaultSlotBracketStyle.thickPercent / 100) * cellPx
  const outTip = outPath.find(
    (point) =>
      Math.abs(point.y - (output.cell.y * cellPx + cellPx / 2)) < 0.01 &&
      point.x > outSpineX,
  )
  assert.ok(outTip)
  assert.ok(outTip.x > outSpineX)
})
