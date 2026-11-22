import assert from 'node:assert/strict'
import test from 'node:test'
import {
  periodMsForRatePerMinute,
  ticksForRatePerMinute,
} from '../game-server/pipeline/elements/rate.ts'
import {
  combinerCraftProgress,
  ratePerMinuteFromPeriodTicks,
  sourceGlyphShouldOrbit,
} from '../src/components/game/pipeline/scene/presentation-rates.ts'

test('periodMsForRatePerMinute', () => {
  assert.equal(periodMsForRatePerMinute(60), 1000)
  assert.equal(periodMsForRatePerMinute(120), 500)
})

test('ticksForRatePerMinute', () => {
  assert.equal(ticksForRatePerMinute(60, 250), 4)
})

test('ratePerMinuteFromPeriodTicks inverts tick period', () => {
  assert.equal(ratePerMinuteFromPeriodTicks(4, 250), 60)
})

test('sourceGlyphShouldOrbit hold window', () => {
  const periodMs = 1000
  assert.equal(sourceGlyphShouldOrbit(true, undefined, 5000, periodMs), true)
  assert.equal(sourceGlyphShouldOrbit(false, undefined, 5000, periodMs), false)
  assert.equal(sourceGlyphShouldOrbit(false, 4000, 4999, periodMs), true)
  assert.equal(sourceGlyphShouldOrbit(false, 4000, 5001, periodMs), true)
  assert.equal(sourceGlyphShouldOrbit(false, 4000, 5999, periodMs), true)
  assert.equal(sourceGlyphShouldOrbit(false, 4000, 6000, periodMs), false)
})

test('combinerCraftProgress', () => {
  // 60/min at 250ms → 4 ticks; remaining starts at 3 and counts down.
  assert.equal(combinerCraftProgress(3, 60, 250, 0), 0)
  assert.equal(combinerCraftProgress(3, 60, 250, 1), 1 / 3)
  assert.equal(combinerCraftProgress(2, 60, 250, 0), 1 / 3)
  assert.equal(combinerCraftProgress(1, 60, 250, 1), 1)
  assert.equal(combinerCraftProgress(0, 60, 250), 1)
  assert.equal(combinerCraftProgress(4, 60, 250), 0)
})