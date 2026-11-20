import assert from 'node:assert/strict'
import { test } from 'node:test'
import { glyphSpaceScale, sceneLod } from '../src/components/game/pipeline/scene/scene-lod.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

test('sceneLod uses detail, structure, and cores bands from rules', () => {
  const rules = testPipelineRules({ lodDetailMinZoom: 0.55, lodStructureMinZoom: 0.22 })
  assert.deepEqual(sceneLod(0.8, rules), {
    packetGlyphs: true,
    beltChevrons: true,
    machines: 'full',
  })
  assert.deepEqual(sceneLod(0.55, rules), {
    packetGlyphs: true,
    beltChevrons: true,
    machines: 'full',
  })
  assert.deepEqual(sceneLod(0.4, rules), {
    packetGlyphs: false,
    beltChevrons: false,
    machines: 'flat',
  })
  assert.deepEqual(sceneLod(0.22, rules), {
    packetGlyphs: false,
    beltChevrons: false,
    machines: 'flat',
  })
  assert.deepEqual(sceneLod(0.1, rules), {
    packetGlyphs: false,
    beltChevrons: false,
    machines: 'cores',
  })
})

test('glyphSpaceScale stays screen-fixed until resourceGlyphWorldMinZoom', () => {
  const rules = testPipelineRules({ resourceGlyphWorldMinZoom: 1.25 })
  assert.equal(glyphSpaceScale(0.5, rules), 2)
  assert.equal(glyphSpaceScale(1, rules), 1)
  assert.equal(glyphSpaceScale(1.25, rules), 1)
  assert.equal(glyphSpaceScale(2, rules), 1)
})
