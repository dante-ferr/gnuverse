import type { Match } from '../match.ts'
import { chapterToVersion, coreDemands } from './demands.ts'

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
  return coreDemands(match.rules, match.chapter, match.deliveryByShape, match.sandbox).every(
    (demand) => demand.received >= demand.required,
  )
}

/** Auto-advance to the next chapter when every active demand is met. */
export function tryAutoUnlock(match: Match): boolean {
  if (match.sandbox) return false
  const lastChapter = match.rules.elements.chapters.length
  if (match.chapter >= lastChapter) return false
  if (!demandsSatisfied(match)) return false
  match.chapter += 1
  match.version = chapterToVersion(match.chapter)
  return true
}

export function forceAdvance(match: Match): void {
  const lastChapter = match.rules.elements.chapters.length
  if (match.chapter < lastChapter) {
    match.chapter += 1
    match.version = chapterToVersion(match.chapter)
    return
  }
  match.version = bumpPipelineVersion(match.version)
}