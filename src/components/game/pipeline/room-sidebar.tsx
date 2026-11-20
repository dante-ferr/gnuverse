'use client'

import { useState } from 'react'
import type { GameApi } from '../api/game-api'
import type { GameEvent, Member, Proposal, User } from '../model/types'
import type { EditMode } from './scene/pipeline-scene'
import type { PipelineFrame, PipelineRules } from './model/frame'
import { CoreRequirementsSidebar } from './core-requirements-sidebar'
import { RoomDecisions } from './room-decisions'
import { RoomParticipants } from './room-participants'
import { StructurePalette } from './structure-palette'
import { CombinerPlaceControls } from './combiner-place-controls'
import { GameHelpOverlay } from './game-help-overlay'
import styles from '../game-shell.module.css'

type SidebarPage = 'jogo' | 'participantes' | 'decisoes'

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
  structureId: string
  onSelectStructure: (id: string) => void
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  onRotate?: () => void
  api: GameApi
  roomId: string
  user: User | null
  creatorId: string
  members: Member[]
  proposals: Proposal[]
  events: GameEvent[]
  busy?: boolean
  canAdvance?: boolean
  onAdvance?: () => void
  onRefresh: () => Promise<void>
  onError: (message: string) => void
}

const pages: { id: SidebarPage; label: string }[] = [
  { id: 'jogo', label: 'Jogo' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'decisoes', label: 'Decisões' },
]

/** Three-page room sidebar (Jogo, Participantes, Decisões). */
export function RoomSidebar({
  frame,
  rules,
  structureId,
  onSelectStructure,
  editMode,
  onEditModeChange,
  onRotate,
  api,
  roomId,
  user,
  creatorId,
  members,
  proposals,
  events,
  busy,
  canAdvance,
  onAdvance,
  onRefresh,
  onError,
}: Props) {
  const [page, setPage] = useState<SidebarPage>('jogo')
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <aside className={styles.gameSidebar} aria-label="Painel da sala">
      <div className={styles.sidebarTabRow}>
        <div className={styles.tabs} role="tablist" aria-label="Páginas da sala">
          {pages.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={page === item.id}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.gameHelpButton}
          aria-label="Ajuda e controles"
          title="Ajuda"
          onClick={() => setHelpOpen(true)}
        >
          ?
        </button>
      </div>
      {helpOpen ? (
        <GameHelpOverlay sandbox={frame?.sandbox === true} onClose={() => setHelpOpen(false)} />
      ) : null}
      <div className={styles.sidebarPage} role="tabpanel">
        {page === 'jogo' ? (
          <div className={styles.sidebarPageStack}>
            <StructurePalette
              frame={frame}
              selectedStructureId={structureId}
              onSelectStructure={onSelectStructure}
              editMode={editMode}
              onEditModeChange={onEditModeChange}
              onRotate={onRotate}
            />
            <CombinerPlaceControls structureId={structureId} />
            <CoreRequirementsSidebar frame={frame} rules={rules} />
          </div>
        ) : null}
        {page === 'participantes' ? (
          <RoomParticipants
            api={api}
            roomId={roomId}
            user={user}
            creatorId={creatorId}
            members={members}
            events={events}
            collaborators={frame?.collaborators ?? []}
            busy={busy}
            onRefresh={onRefresh}
            onError={onError}
          />
        ) : null}
        {page === 'decisoes' ? (
          <RoomDecisions
            api={api}
            roomId={roomId}
            user={user}
            creatorId={creatorId}
            members={members}
            proposals={proposals}
            busy={busy}
            canAdvance={canAdvance}
            onAdvance={onAdvance}
            onRefresh={onRefresh}
            onError={onError}
          />
        ) : null}
      </div>
    </aside>
  )
}
