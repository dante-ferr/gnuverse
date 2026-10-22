import type { GameEvent } from '../model/types'

const mode = (value: unknown) => (value === 'vote' ? 'votação' : 'BDFL')

function rulesText(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  const rules = value as Record<string, unknown>
  return `${rules.cost} moedas/bloco; banimentos por ${mode(rules.banMode)}; restaurações por ${mode(rules.restoreMode)}; eleitores ${rules.eligibilityMode === 'manual' ? 'habilitados manualmente' : `após ${rules.minContributions} contribuições`}`
}

export function EventDetail({ event }: { event: GameEvent }) {
  if (!event.detail || typeof event.detail !== 'object') return null
  const detail = event.detail as Record<string, unknown>
  if (event.type === 'settings')
    return (
      <span>
        Antes: {rulesText(detail.before)}. Depois: {rulesText(detail.after)}.
        Motivo: {String(detail.reason || '')}
      </span>
    )
  if (event.type === 'vote-result')
    return (
      <span>
        {detail.accepted ? 'Aprovada' : 'Rejeitada'}: {Number(detail.for)} a
        favor, {Number(detail.against)} contra, {Number(detail.abstain)}{' '}
        abstenções.
      </span>
    )
  if (event.type === 'vote')
    return (
      <span>
        {
          (
            {
              for: 'A favor',
              against: 'Contra',
              abstain: 'Abstenção',
            } as Record<string, string>
          )[String(detail.choice)]
        }
      </span>
    )
  if ('reason' in detail) return <span>{String(detail.reason)}</span>
  return null
}
