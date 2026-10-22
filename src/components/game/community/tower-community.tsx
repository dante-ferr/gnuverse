'use client'

import {
  type Proposal,
  type Snapshot,
  type TowerState,
  type User,
} from '../model/types'
import { governanceLabel } from '../model/presentation'
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
  onPreview: (version: Snapshot | null) => void
  onRestore: (version: Snapshot) => void
  onBan: (id: string) => void
  onVote: (proposal: Proposal, choice: string) => void
  onDecide: (proposal: Proposal, accept: boolean, reason: string) => void
  onEligibility: (id: string, eligible: boolean) => void
  onSettingsSave: (body: Record<string, string | number>) => Promise<void>
}
export function TowerCommunity({
  state,
  user,
  busy,
  isBanned,
  tab,
  onTabChange,
  onPreview,
  onRestore,
  onBan,
  onVote,
  onDecide,
  onEligibility,
  onSettingsSave,
}: Props) {
  return (
    <section className={styles.collective}>
      <div className={styles.collectiveHeading}>
        <div>
          <p className={styles.eyebrow}>Mais que empilhar</p>
          <h2>Uma torre, muitas decisões.</h2>
        </div>
        <p>
          Restauração:{' '}
          <strong>{governanceLabel(state.tower.restoreMode)}</strong>
          <br />
          Banimento: <strong>{governanceLabel(state.tower.banMode)}</strong>
          <br />
          Eleitores:{' '}
          <strong>
            {state.tower.eligibilityMode === 'manual'
              ? 'habilitados pelo BDFL'
              : `a partir de ${state.tower.minContributions} contribuições`}
          </strong>
          <br />
          Suspensão do criador:{' '}
          <strong>
            {state.tower.allowCreatorBan
              ? 'permitida por votação'
              : 'não permitida'}
          </strong>{' '}
          · escolha definitiva
        </p>
      </div>
      {user?.id === state.tower.creatorId && (
        <TowerSettings
          tower={state.tower}
          maxCost={Number(state.rules.maxCost)}
          disabled={
            busy ||
            isBanned ||
            state.proposals.some((proposal) => proposal.status === 'pending')
          }
          onSave={onSettingsSave}
        />
      )}
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Comunidade da torre"
      >
        {(
          [
            ['history', 'Versões & histórico'],
            ['community', 'Quem constrói'],
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
        {tab === 'history' && (
          <HistoryPanel
            state={state}
            user={user}
            busy={busy}
            onPreview={onPreview}
            onPropose={onRestore}
          />
        )}
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
            onPreview={onPreview}
            onVote={onVote}
            onDecide={onDecide}
          />
        )}
      </div>
    </section>
  )
}
