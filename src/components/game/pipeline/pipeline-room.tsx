'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { canManageRoom } from '../../../../core/authz/policy'
import { createRoomFromForm } from '../api/create-room'
import { CreateRoomPanel } from '../construction/create-room-panel'
import { GameTopBar } from '../game-top-bar'
import { RoomToolbar } from '../construction/room-toolbar'
import { useActionFeedback } from '../hooks/use-action-feedback'
import { useGameSession } from '../hooks/use-game-session'
import { useRoomLobby } from '../hooks/use-room-lobby'
import { pipelineRulesFrom } from './model/frame'
import type { Wallet } from '../model/types'
import { usePipelineStream } from './hooks/use-pipeline-stream'
import { useProgressionNotice } from './hooks/use-progression-notice'
import { RoomChatSidebar } from './room-chat-sidebar'
import { RoomSidebar } from './room-sidebar'
import { RoomTutorialOverlay } from './room-tutorial-overlay'
import { hasSeenRoomTutorial, markRoomTutorialSeen } from './tutorial-memory'
import { PipelineScene, type EditMode } from './scene/pipeline-scene'
import {
  defaultStructureId,
  getStructure,
  type StructurePlaceRequest,
} from './structures'
import { clearTunnelPlacement } from './structures/tunnel.ts'
import styles from '../game-shell.module.css'

function roomLoginHref() {
  if (typeof window === 'undefined') return '/login/'
  return `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

/** Room chrome, compact sidebar, and the grid canvas. */
export function PipelineRoom() {
  const session = useGameSession()
  const lobby = useRoomLobby(session.api)
  const live = usePipelineStream(session.api, lobby.roomId)
  const feedback = useActionFeedback()
  const router = useRouter()
  const [loginHref, setLoginHref] = useState('/login/')
  const [editMode, setEditMode] = useState<EditMode>('create')
  const [structureId, setStructureId] = useState(defaultStructureId)
  const [placeEpoch, setPlaceEpoch] = useState(0)
  const selectStructure = (id: string) => {
    clearTunnelPlacement()
    setStructureId(id)
    setEditMode('create')
  }
  const chatMaxLength =
    typeof live.rules?.chatMessageMaxLength === 'number' && live.rules.chatMessageMaxLength > 0
      ? live.rules.chatMessageMaxLength
      : 280
  const [showCreate, setShowCreate] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const rules = pipelineRulesFrom(live.rules ?? lobby.rules)
  const isAdmin = Boolean(session.user?.roles?.includes('admin'))
  useEffect(() => {
    setLoginHref(roomLoginHref())
  }, [lobby.roomId])
  useEffect(() => {
    if (!lobby.roomId || !live.frame.seed) return
    if (hasSeenRoomTutorial()) return
    setTutorialOpen(true)
  }, [lobby.roomId, live.frame.seed])
  const closeTutorial = () => {
    markRoomTutorialSeen()
    setTutorialOpen(false)
  }
  const openLogin = () => {
    router.push(roomLoginHref())
  }
  useEffect(() => {
    if (!session.user || !lobby.roomId) return
    const roomId = lobby.roomId
    const api = session.api
    let active = true
    const beat = () => api.request(`/api/rooms/${roomId}/presence`, {}).catch(() => {})
    // Heartbeats tell the server this player still has the room open (labels vanish after they leave).
    void api
      .request(`/api/rooms/${roomId}/join`, {})
      .catch(() => {})
      .then(() => {
        if (active) void beat()
      })
    const timer = setInterval(() => void beat(), 15_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [session.user, session.api, lobby.roomId])
  useProgressionNotice(live.frame.seed ? live.frame : null, feedback.setNotice)
  useEffect(() => {
    if (!feedback.notice) return
    const timer = setTimeout(() => feedback.setNotice(''), 2500)
    return () => clearTimeout(timer)
  }, [feedback.notice, feedback.setNotice])
  const applyWallet = (result: unknown) => {
    if (!result || typeof result !== 'object' || !('wallet' in result)) return
    const wallet = (result as { wallet?: Wallet | null }).wallet
    if (wallet) session.setWallet(wallet)
  }
  const place = (request: StructurePlaceRequest) => {
    const structure = getStructure(request.structureId)
    if (!structure) return
    if (!session.user) {
      feedback.setError(structure.signInMessage)
      return
    }
    // Queue, never drop: a stroke made while the previous one is in flight still lands.
    void feedback.queue(async () => {
      await structure.commit(
        {
          roomId: lobby.roomId,
          request: async (path, body, method) => {
            const result = await session.api.request(path, body, method)
            applyWallet(result)
            if (result && typeof result === 'object' && 'frame' in result)
              live.applyFrame((result as { frame: unknown }).frame)
            return result
          },
        },
        request.payload,
      )
      // The edit response already carries the frame; the server's `change` event refetches the rest.
    })
  }
  const removeRefresh = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advance = () => {
    if (!session.user || !isAdmin) return
    void feedback.run(async () => {
      await session.api.request(`/api/rooms/${lobby.roomId}/advance`, {})
      await live.refresh()
    })
  }
  const contributeChunk = (coord: { cx: number; cy: number }, amount: number) => {
    if (!session.user) {
      router.push(loginHref)
      return
    }
    void feedback.run(async () => {
      const result = await session.api.request<{
        frame: unknown
        wallet: NonNullable<typeof session.wallet>
      }>(`/api/rooms/${lobby.roomId}/buy-chunk`, { ...coord, amount })
      applyWallet(result)
      await live.refresh()
    })
  }
  const contributeCore = (coord: { cx: number; cy: number }, amount: number) => {
    if (!session.user) {
      router.push(loginHref)
      return
    }
    void feedback.run(async () => {
      const result = await session.api.request<{
        frame: unknown
        wallet: NonNullable<typeof session.wallet>
      }>(`/api/rooms/${lobby.roomId}/buy-core`, { ...coord, amount })
      applyWallet(result)
      await live.refresh()
    })
  }
  const sendChat = (text: string) => {
    if (!session.user) {
      router.push(loginHref)
      return
    }
    // Chat never waits for, or is dropped by, an in-flight edit.
    void session.api
      .request(`/api/rooms/${lobby.roomId}/chat`, { text })
      .catch((cause) =>
        feedback.setError(
          cause instanceof Error ? cause.message : 'O servidor não respondeu. Confira a conexão.',
        ),
      )
  }
  const remove = (cells: { x: number; y: number }[], options: { revert: () => void }) => {
    if (cells.length === 0) return
    if (!session.user) {
      feedback.setError('Entre para remover esteiras ou combinadores.')
      options.revert()
      return
    }
    let failed = false
    for (const cell of cells) {
      void session.api
        .request(`/api/rooms/${lobby.roomId}/remove`, cell)
        .then((result) => applyWallet(result))
        .catch((cause) => {
          if (!failed) {
            failed = true
            options.revert()
          }
          feedback.setError(
            cause instanceof Error
              ? cause.message
              : 'O servidor não respondeu. Confira a conexão.',
          )
        })
        .finally(() => {
          if (removeRefresh.current) clearTimeout(removeRefresh.current)
          removeRefresh.current = setTimeout(() => {
            removeRefresh.current = null
            void live.refresh()
          }, 60)
        })
    }
  }
  return (
    <main className={styles.gameShell}>
      <GameTopBar
        user={session.user}
        wallet={session.wallet}
        secondsToCoin={session.secondsToCoin}
        busy={feedback.busy}
        onLogout={() => feedback.run(session.logout)}
        onOpenAuth={openLogin}
      >
        <RoomToolbar
          connection={lobby.roomId ? live.connection : lobby.connection}
          title={live.name?.trim() || 'Sala'}
          onCreate={() => setShowCreate(true)}
          canDelete={Boolean(
            session.user &&
              live.creatorId &&
              canManageRoom(
                { ...session.user, roles: session.user.roles ?? [] },
                'delete',
                live.creatorId,
              ),
          )}
          onDelete={() =>
            feedback.run(async () => {
              await session.api.request(`/api/rooms/${lobby.roomId}`, undefined, 'DELETE')
              router.push('/jogo/')
            })
          }
        />
      </GameTopBar>
      {feedback.error ? (
        <div className={styles.playToast} role="alert">
          {feedback.error}
        </div>
      ) : null}
      {feedback.notice ? (
        <div className={`${styles.playToast} ${styles.playToastNotice}`} role="status">
          {feedback.notice}
        </div>
      ) : null}
      {showCreate && (
        <CreateRoomPanel
          busy={feedback.busy}
          error={feedback.error}
          loading={!lobby.rules}
          loginHref={
            session.user
              ? undefined
              : `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
          }
          minContributions={Number(lobby.rules?.minContributions ?? 1)}
          onClose={() => setShowCreate(false)}
          onCreateRoom={(form) =>
            feedback.run(async () => {
              const result = await createRoomFromForm(session.api, form)
              setShowCreate(false)
              lobby.setRoomId(result.room.id)
            })
          }
        />
      )}
      {tutorialOpen ? <RoomTutorialOverlay rules={rules} onClose={closeTutorial} /> : null}
      {lobby.roomId ? (
        <div className={styles.pipelinePlay}>
          <RoomChatSidebar
            messages={live.chat}
            user={session.user}
            loginHref={loginHref}
            maxLength={chatMaxLength}
            onSend={sendChat}
          />
          <div className={styles.sceneViewport}>
            <PipelineScene
              roomId={lobby.roomId}
              frame={live.frame.seed ? live.frame : null}
              rules={rules}
              editMode={editMode}
              structureId={structureId}
              userId={session.user?.id ?? null}
              presence={live.presence}
              chunkCost={
                rules
                  ? rules.chunkCostBase +
                    rules.chunkCostStep *
                      Math.max(0, (live.frame.ownedChunks?.length ?? 1) - 1)
                  : null
              }
              coinBalance={session.user ? (session.wallet?.balance ?? 0) : null}
              buyBusy={feedback.busy}
              onContributeChunk={contributeChunk}
              onContributeCore={contributeCore}
              onPlace={place}
              onRemove={remove}
              placeEpoch={placeEpoch}
              onToggleEditMode={() =>
                setEditMode((current) => (current === 'create' ? 'delete' : 'create'))
              }
              onSelectStructure={selectStructure}
            />
          </div>
          <RoomSidebar
            frame={live.frame.seed ? live.frame : null}
            rules={rules}
            structureId={structureId}
            onSelectStructure={selectStructure}
            editMode={editMode}
            onEditModeChange={setEditMode}
            onRotate={() => {
              clearTunnelPlacement()
              getStructure(structureId)?.rotate?.()
              setPlaceEpoch((n) => n + 1)
            }}
            api={session.api}
            roomId={lobby.roomId}
            user={session.user}
            creatorId={live.creatorId}
            members={live.members}
            proposals={live.proposals}
            checkpoints={live.checkpoints}
            governance={live.governance}
            busy={feedback.busy}
            canAdvance={Boolean(lobby.roomId && isAdmin)}
            onAdvance={advance}
            onRefresh={live.refresh}
            onError={feedback.setError}
            onOpenTutorial={() => setTutorialOpen(true)}
          />
        </div>
      ) : (
        <p className={styles.message} role="status">
          Nenhuma sala ainda. Crie uma para ligar a fonte ao núcleo.
        </p>
      )}
    </main>
  )
}
