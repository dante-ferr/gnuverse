import assert from 'node:assert/strict'
import test from 'node:test'
import {
  catalogToJson,
  loadElementCatalog,
} from '../game-server/pipeline/elements/load-catalog.mjs'
import type { ElementCatalogJson } from '../game-server/pipeline/elements/index.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import {
  deliveryScore,
  materialUnits,
} from '../game-server/pipeline/world/progression/score.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()

function rulesWithScoreFactor(factor: number) {
  const elements: ElementCatalogJson = {
    ...rules.elements,
    scoreEffortFactor: factor,
  }
  return testPipelineRules({ elements })
}

test('tier-1 leaves and circle are one material unit', () => {
  assert.equal(materialUnits(rules, 'fire'), 1)
  assert.equal(materialUnits(rules, 'water'), 1)
  assert.equal(materialUnits(rules, 'circle'), 1)
})

test('steam sums recipe inputs (2 units at factor 1)', () => {
  assert.equal(materialUnits(rules, 'steam'), 2)
  assert.equal(deliveryScore(rules, 'steam'), 2)
})

test('score_effort_factor scales delivery points', () => {
  const tuned = rulesWithScoreFactor(1.5)
  assert.equal(deliveryScore(tuned, 'steam'), 3)
})

test('dual outputs split input mass equally (storm, lightning, kiln, brick)', () => {
  const stormMass = materialUnits(rules, 'storm')
  const lightningMass = materialUnits(rules, 'lightning')
  assert.equal(stormMass, lightningMass)
  assert.ok(stormMass > 0)

  const kilnMass = materialUnits(rules, 'kiln')
  const brickMass = materialUnits(rules, 'brick')
  assert.equal(kilnMass, brickMass)
  assert.ok(kilnMass > 1)
})

test('tempest uses recursive dual-output values on inputs', () => {
  const storm = materialUnits(rules, 'storm')
  const lightning = materialUnits(rules, 'lightning')
  const cloud = materialUnits(rules, 'cloud')
  const expected = storm + lightning + cloud
  assert.equal(materialUnits(rules, 'tempest'), expected)
  assert.ok(expected > storm)
})

test('recordDelivery adds steam score to lifetime deliveries', () => {
  const match = Match.create('score-steam', rules)
  match.recordDelivery('steam')
  assert.equal(match.deliveryByShape.steam, 1)
  assert.equal(match.deliveries, 2)
})

test('catalog loads score_effort_factor from elements.toml', () => {
  const json = catalogToJson(loadElementCatalog()) as ElementCatalogJson
  assert.equal(json.scoreEffortFactor, 1)
})