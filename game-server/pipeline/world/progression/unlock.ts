import type { Match } from '../match.ts'
import { chapterToVersion, coreDemands, matchDemandProgress } from './demands.ts'

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

/** Bump craft-wave escalation and reset fresh craft quotas. */
function advanceEscalation(match: Match): void {
  match.escalationWave += 1
  match.waveDeliveryByShape = {}
}

/**
 * When every active demand is met: escalate craft quotas (mild geometric),
 * advance chapter while content remains, otherwise stay on the last chapter.
 */
export function tryAutoUnlock(match: Match): boolean {
  if (match.sandbox) return false
  if (!demandsSatisfied(match)) return false

  const lastChapter = match.rules.elements.chapters.length
  if (match.chapter < lastChapter) {
    match.chapter += 1
    match.version = chapterToVersion(match.chapter)
  }
  advanceEscalation(match)
  return true
}

export function forceAdvance(match: Match): void {
  const lastChapter = match.rules.elements.chapters.length
  if (match.chapter < lastChapter) {
    match.chapter += 1
    match.version = chapterToVersion(match.chapter)
  }
  advanceEscalation(match)
}
