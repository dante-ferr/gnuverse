'use client'

import { canManageTower } from '../../../../core/authz/policy'
import { type Proposal, type TowerState, type User } from '../model/types'
import { HistoryPanel } from './history-panel'
import { MembersPanel } from './members-panel'
import { ProposalsPanel } from './proposals-panel'
import { TowerSettings } from './tower-settings'
import styles from '../tower-game.module.css'

type Tab = 'history' | 'community' | 'decisions'
type Props = {
  state: TowerState
  user: User | null
  busy: boolean
  isBanned: boolean
  tab: Tab
  onTabChange: (tab: Tab) => void
  onBan: (id: string) => void
  onDecide: (proposal: Proposal, accept: boolean, reason: string) => void
  onEligibility: (id: string, eligible: boolean) => void
  onSettingsSave: (body: Record<string, string | number | boolean>) => Promise<void>
}
export function TowerCommunity({
  state,
  user,
  busy,
  isBanned,
  tab,
  onTabChange,
  onBan,
  onDecide,
  onEligibility,
  onSettingsSave,
}: Props) {
  const actor = user ? { ...user, roles: user.roles ?? [] } : null
  const canEdit = canManageTower(actor, 'update', state.tower.creatorId)
  return (
    <section className={styles.collective}>
      <div className={styles.collectiveHeading}>
        <div>
          <h2>Comunidade</h2>
        </div>
      </div>
      {!canEdit && (
        <details className={styles.eventLog}>
          <summary>Regras da árvore</summary>
          <ul className={styles.rules}>
            <li>Custo de referência: {state.tower.cost} moedas (ações usam tabela fixa).</li>
            <li>Suspensão: decidida pelo BDFL.</li>
            <li>
              Quem pode propor:{' '}
              {state.tower.eligibilityMode === 'manual'
                ? 'habilitados pelo BDFL'
                : `após ${state.tower.minContributions} contribuições`}
              .
            </li>
            <li>
              Suspensão do criador:{' '}
              {state.tower.allowCreatorBan
                ? 'permitida mediante proposta'
                : 'indisponível'}{' '}
              (definitivo).
            </li>
          </ul>
        </details>
      )}
      {canEdit && (
        <TowerSettings
          administrator={false}
          tower={state.tower}
          maxCost={Number(state.rules.maxCost)}
          windActive={false}
          disabled={
            busy ||
            (isBanned ||
              state.proposals.some((proposal) => proposal.status === 'pending'))
          }
          blockedReason={
            isBanned
              ? 'Sua participação nesta árvore está suspensa.'
              : state.proposals.some((proposal) => proposal.status === 'pending')
                ? 'Aguarde a conclusão da proposta em andamento.'
                : undefined
          }
          onSave={onSettingsSave}
        />
      )}
      <div className={styles.tabs} role="tablist" aria-label="Comunidade da árvore">
        {(
          [
            ['history', 'Versões & histórico'],
            ['community', 'Quem cultiva'],
            ['decisions', 'Decisões públicas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            onClick={() => onTabChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'history' && <HistoryPanel state={state} />}
        {tab === 'community' && (
          <MembersPanel
            state={state}
            user={user}
            busy={busy}
            isBanned={isBanned}
            onEligibility={onEligibility}
            onBan={onBan}
          />
        )}
        {tab === 'decisions' && (
          <ProposalsPanel
            state={state}
            user={user}
            busy={busy || isBanned}
            onDecide={onDecide}
          />
        )}
      </div>
    </section>
  )
}