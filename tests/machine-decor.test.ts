import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { loadGameConfig } from '../game-server/config/load-game-config.ts'
import { darkenHex } from '../src/components/game/pipeline/scene/painters/darken-hex.ts'

const root = path.resolve(import.meta.dirname, '..')

test('darkenHex multiplies RGB by (100 - percent) / 100', () => {
  assert.equal(darkenHex('#ffffff', 35), '#a6a6a6')
  assert.equal(darkenHex('#52d6c9', 35), '#358b83')
  assert.equal(darkenHex('#000000', 40), '#000000')
})

test('pipeline config exposes decor_darken_percent', () => {
  const { pipeline } = loadGameConfig()
  assert.equal(pipeline.decorDarkenPercent, 35)
})

test('pipeline config exposes core gear rotation periods', () => {
  const { pipeline } = loadGameConfig()
  assert.equal(pipeline.coreGearOuterMs, 12000)
  assert.equal(pipeline.coreGearInnerMs, 7000)
})

test('pipeline config exposes decor_stroke_width for art sync', () => {
  const { pipeline } = loadGameConfig()
  assert.equal(pipeline.decorStrokeWidth, 28)
})

test('resource-circle SVG is a single filled black disk', () => {
  const svg = readFileSync(path.join(root, 'public/pipeline', 'resource-circle.svg'), 'utf8')
  const lower = svg.toLowerCase()
  assert.match(lower, /fill="#000000"/)
  assert.ok(!lower.includes('stroke-width'), 'resource-circle is fill-only (outline drawn on canvas)')
  const circles = svg.match(/<circle\b/gi)
  assert.equal(circles?.length ?? 0, 1, 'resource-circle must be one disk, no nested circles')
})

test('machine decor SVGs are pure black ink on transparent', () => {
  for (const file of [
    'core-frame.svg',
    'core-gear-outer.svg',
    'core-gear-inner.svg',
    'source-decor.svg',
  ]) {
    const svg = readFileSync(path.join(root, 'public/pipeline', file), 'utf8').toLowerCase()
    assert.ok(!svg.includes('#52d6c9'), `${file} must not embed accent; tint at draw time`)
    assert.match(svg, /#000000|"#000"/)
  }
})