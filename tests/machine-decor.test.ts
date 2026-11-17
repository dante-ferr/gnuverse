import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { loadGameConfig } from '../game-server/config/load-game-config.ts'

const root = path.resolve(import.meta.dirname, '..')

test('pipeline decor SVGs use decor_stroke_width from config', () => {
  const { pipeline } = loadGameConfig()
  const width = String(pipeline.decorStrokeWidth)
  for (const file of ['core-decor.svg', 'source-decor.svg', 'resource-circle.svg']) {
    const svg = readFileSync(path.join(root, 'public/pipeline', file), 'utf8')
    assert.match(
      svg,
      new RegExp(`stroke-width="${width}"`),
      `${file} must include thick strokes at decor_stroke_width`,
    )
  }
})

test('machine decor SVGs are pure black ink on transparent', () => {
  for (const file of ['core-decor.svg', 'source-decor.svg']) {
    const svg = readFileSync(path.join(root, 'public/pipeline', file), 'utf8').toLowerCase()
    assert.ok(!svg.includes('#52d6c9'), `${file} must not embed accent; tint at draw time`)
    assert.match(svg, /#000000|"#000"/)
  }
})