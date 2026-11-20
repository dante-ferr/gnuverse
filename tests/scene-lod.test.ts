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

test('glyphSpaceScale is screen-fixed when zoomed in; world-shrinks below threshold', () => {
  const rules = testPipelineRules({ resourceGlyphWorldMinZoom: 1.25 })
  // Zoomed in: cancel camera zoom → on-screen diameter = resource_glyph_size_px.
  assert.equal(glyphSpaceScale(2.5, rules), 0.4)
  assert.equal(glyphSpaceScale(1.25, rules), 0.8)
  // Zoomed out: fixed world scale 1/t (continuous at threshold; screen = size * z / t).
  assert.equal(glyphSpaceScale(1, rules), 0.8)
  assert.equal(glyphSpaceScale(0.5, rules), 0.8)
  // Threshold only switches mode; locked screen size stays size_px (space = 1/z).
  const lowThreshold = testPipelineRules({ resourceGlyphWorldMinZoom: 0.2 })
  assert.equal(glyphSpaceScale(2.5, lowThreshold), 0.4)
  assert.equal(glyphSpaceScale(0.1, lowThreshold), 5)
})
