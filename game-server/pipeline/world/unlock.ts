import type { PipelineRules } from '../rules.ts'
import { coreDemands } from './demands.ts'
import type { Match } from './match.ts'

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
  return coreDemands(match.rules, match.version, match.deliveryByShape).every(
    (demand) => demand.received >= demand.required,
  )
}

export function collaboratorsSatisfied(match: Match): boolean {
  return match.collaborators.length >= match.rules.unlockCollaborators
}

/** Auto-advance only from 0.1 → 0.2 when both gates are met. */
export function tryAutoUnlock(match: Match): boolean {
  if (match.version !== '0.1') return false
  if (!demandsSatisfied(match) || !collaboratorsSatisfied(match)) return false
  match.version = bumpPipelineVersion(match.version)
  return true
}

export function forceAdvance(match: Match): void {
  match.version = bumpPipelineVersion(match.version)
}