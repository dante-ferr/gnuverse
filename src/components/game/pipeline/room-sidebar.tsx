'use client'

import { useState } from 'react'
import type { GameApi } from '../api/game-api'
import type { ChatMessage, GameEvent, Member, Proposal, User } from '../model/types'
import type { EditMode } from './scene/pipeline-scene'
import type { PipelineFrame, PipelineRules } from './model/frame'
import { CoreRequirementsSidebar } from './core-requirements-sidebar'
import { RoomChat } from './room-chat'
import { RoomDecisions } from './room-decisions'
import { RoomParticipants } from './room-participants'
import { StructurePalette } from './structure-palette'
import styles from '../game-shell.module.css'

type SidebarPage = 'jogo' | 'participantes' | 'decisoes'

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
  structureId: string
  onSelectStructure: (id: string) => void
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  api: GameApi
  roomId: string
  user: User | null
  creatorId: string
  members: Member[]
  proposals: Proposal[]
  events: GameEvent[]
  chat: ChatMessage[]
  loginHref: string
  chatMaxLength: number
  busy?: boolean
  canAdvance?: boolean
  onAdvance?: () => void
  onRefresh: () => Promise<void>
  onError: (message: string) => void
  onSendChat: (text: string) => void
}

const pages: { id: SidebarPage; label: string }[] = [
  { id: 'jogo', label: 'Jogo' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'decisoes', label: 'Decisões' },
]

/** Three-page room sidebar with chat docked at the bottom. */
export function RoomSidebar({
  frame,
  rules,
  structureId,
  onSelectStructure,
  editMode,
  onEditModeChange,
  api,
  roomId,
  user,
  creatorId,
  members,
  proposals,
  events,
  chat,
  loginHref,
  chatMaxLength,
  busy,
  canAdvance,
  onAdvance,
  onRefresh,
  onError,
  onSendChat,
}: Props) {
  const [page, setPage] = useState<SidebarPage>('jogo')

  return (
    <aside className={styles.gameSidebar} aria-label="Painel da sala">
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
      <div className={styles.sidebarPage} role="tabpanel">
        {page === 'jogo' ? (
          <div className={styles.sidebarPageStack}>
            <StructurePalette
              selectedStructureId={structureId}
              onSelectStructure={onSelectStructure}
              editMode={editMode}
              onEditModeChange={onEditModeChange}
            />
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
      <div className={styles.sidebarDock}>
        <RoomChat
          messages={chat}
          user={user}
          loginHref={loginHref}
          maxLength={chatMaxLength}
          busy={busy}
          onSend={onSendChat}
        />
      </div>
    </aside>
  )
}
