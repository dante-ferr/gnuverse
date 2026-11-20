import assert from 'node:assert/strict'
import test from 'node:test'
import { Match } from '../game-server/pipeline/world/match.ts'
import { activeDemandShapes } from '../game-server/pipeline/world/progression/demands.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()

test('createSandbox has three cores and tier-1 element sources', () => {
  const match = Match.createSandbox('sandbox-layout', rules)
  assert.equal(match.sandbox, true)
  assert.equal(match.cores.length, 3)
  const tierOne = rules.elements.elements.filter((el) => el.tier === 1)
  assert.equal(match.sources.length, tierOne.length)
  for (const el of tierOne) {
    const source = match.sources.find((machine) => machine.shape === el.id)
    assert.ok(source, `missing source for ${el.id}`)
    assert.equal(source.shape, el.id)
  }
})

test('sandbox demands include every catalog element id', () => {
  const match = Match.createSandbox('sandbox-demands', rules)
  const shapes = activeDemandShapes(match.chapter, rules, true)
  assert.equal(shapes.length, rules.elements.elements.length)
  const frame = match.toFrame()
  assert.equal(frame.demands.length, rules.elements.elements.length)
  const steam = frame.demands.find((item) => item.shape === 'steam')
  assert.ok(steam)
  assert.equal(steam.required, rules.elements.elements.find((el) => el.id === 'steam')!.demand_required)
})

test('Match.create uses element-shaped packets in normal rooms', () => {
  const match = Match.create('normal', rules)
  assert.equal(match.sandbox, false)
  assert.equal(match.combiners.length, 0)
  const starters = new Set(rules.elements.starterSourceIds)
  assert.equal(
    match.sources
      .filter((source) => starters.has(match.sourceRoles[source.id] ?? source.shape))
      .every((source) => starters.has(source.shape)),
    true,
  )
})