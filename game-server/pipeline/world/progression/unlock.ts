import type { PacketShape } from '../../packets/packet.ts'
import type { Match } from '../match.ts'
import {
  activeDemandShapes,
  chapterToVersion,
  coreDemands,
  matchDemandProgress,
} from './demands.ts'

/** Parse `major.minor`, increment minor; missing minor treats as `0.1`. */
export function bumpPipelineVersion(version: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(version.trim())
  if (!match) return '0.2'
  const major = Number(match[1])
  const minor = Number(match[2])
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return '0.2'
  return `${major}.${minor + 1}`
}

export function demandsSatisfied(match: Match): boolean {
  return coreDemands(match.rules, matchDemandProgress(match)).every(
    (demand) => demand.received >= demand.required,
  )
}

/** Bump global clear count and per-shape craft waves for shapes just cleared. */
function advanceEscalation(match: Match, clearedShapes: PacketShape[]): void {
  match.escalationWave += 1
  for (const shape of clearedShapes) {
    match.escalationWaveByShape[shape] = (match.escalationWaveByShape[shape] ?? 0) + 1
    delete match.waveDeliveryByShape[shape]
  }
}

/**
 * When every active demand is met: escalate cleared craft quotas,
 * advance chapter while content remains, otherwise stay on the last chapter.
 */
export function tryAutoUnlock(match: Match): boolean {
  if (match.sandbox) return false
  if (!demandsSatisfied(match)) return false

  const clearedShapes = activeDemandShapes(match.chapter, match.rules, false)
  advanceEscalation(match, clearedShapes)

  const lastChapter = match.rules.elements.chapters.length
  if (match.chapter < lastChapter) {
    match.chapter += 1
    match.version = chapterToVersion(match.chapter)
  }
  return true
}

export function forceAdvance(match: Match): void {
  const clearedShapes = activeDemandShapes(match.chapter, match.rules, false)
  advanceEscalation(match, clearedShapes)

  const lastChapter = match.rules.elements.chapters.length
  if (match.chapter < lastChapter) {
    match.chapter += 1
    match.version = chapterToVersion(match.chapter)
  }
}