'use client'

import { useEffect, useState } from 'react'
import { CenteredOverlay } from '../../overlay/centered-overlay'
import type { GameApi } from '../api/game-api'
import { formatGameDate } from '../model/presentation'
import type { Checkpoint } from '../model/types'
import { FramePreview } from '../preview/frame-preview'
import { isPipelineFrame, type PipelineFrame, type PipelineRules } from './model/frame'
import styles from './checkpoint-timeline-overlay.module.css'

export const checkpointKindLabels: Record<Checkpoint['kind'], string> = {
  created: 'Início da sala',
  spend: 'Checkpoint',
  'pre-restore': 'Antes de restaurar',
}

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value)

type Props = {
  api: GameApi
  roomId: string
  rules: PipelineRules | null
  checkpoints: Checkpoint[]
  /** Checkpoint a pending restore proposal points at. */
  pendingTargetId: string | null
  /** Whether this viewer may propose (or, as owner, apply) a restore now. */
  canPropose: boolean
  proposeLabel: string
  busy?: boolean
  onPropose: (snapshotId: string, reason: string) => Promise<boolean>
  onClose: () => void
}

/** Checkpoint timeline: pick a point, preview its factory, propose restoring it. */
export function CheckpointTimelineOverlay({
  api,
  roomId,
  rules,
  checkpoints,
  pendingTargetId,
  canPropose,
  proposeLabel,
  busy,
  onPropose,
  onClose,
}: Props) {
  const timeline = [...checkpoints].sort((a, b) => b.createdAt - a.createdAt)
  const [selectedId, setSelectedId] = useState(timeline[0]?.id ?? '')
  const [frames, setFrames] = useState<Record<string, PipelineFrame | 'error'>>({})
  const [reason, setReason] = useState('')
  const selected = timeline.find((checkpoint) => checkpoint.id === selectedId) ?? null
  const frame = selected ? frames[selected.id] : undefined

  useEffect(() => {
    if (!selectedId || frames[selectedId]) return
    let active = true
    api
      .request<{ frame: PipelineFrame }>(
        `/api/rooms/${encodeURIComponent(roomId)}/snapshots/${encodeURIComponent(selectedId)}`,
      )
      .then((result) => {
        if (!active) return
        setFrames((current) => ({
          ...current,
          [selectedId]: isPipelineFrame(result.frame) ? result.frame : 'error',
        }))
      })
      .catch(() => {
        if (active) setFrames((current) => ({ ...current, [selectedId]: 'error' }))
      })
    return () => {
      active = false
    }
  }, [api, roomId, selectedId, frames])

  const submit = async () => {
    if (!selected) return
    if (await onPropose(selected.id, reason)) onClose()
  }

  return (
    <CenteredOverlay title="Linha do tempo" onClose={onClose} className={styles.overlay}>
      {timeline.length === 0 ? (
        <p className={styles.empty}>Nenhum checkpoint ainda.</p>
      ) : (
        <div className={styles.layout}>
          <ol className={styles.timeline} aria-label="Checkpoints">
            {timeline.map((checkpoint) => (
              <li key={checkpoint.id}>
                <button
                  type="button"
                  className={styles.item}
                  aria-current={checkpoint.id === selectedId ? 'true' : undefined}
                  onClick={() => setSelectedId(checkpoint.id)}
                >
                  <span className={styles.itemTitle}>
                    {checkpointKindLabels[checkpoint.kind]}
                    {checkpoint.id === pendingTargetId ? (
                      <span className={styles.badge}>Em votação</span>
                    ) : null}
                  </span>
                  <time dateTime={new Date(checkpoint.createdAt).toISOString()}>
                    {formatGameDate(checkpoint.createdAt)}
                  </time>
                </button>
              </li>
            ))}
          </ol>
          {selected ? (
            <section className={styles.detail} aria-label="Prévia do checkpoint">
              <FramePreview
                frame={frame && frame !== 'error' ? frame : null}
                rules={rules}
                className={styles.preview}
              />
              {frame === 'error' ? (
                <p className={styles.empty}>Não foi possível carregar a prévia.</p>
              ) : null}
              <dl className={styles.stats}>
                <div>
                  <dt>Versão</dt>
                  <dd>{selected.version}</dd>
                </div>
                <div>
                  <dt>Pontuação</dt>
                  <dd>{formatNumber(selected.deliveries)}</dd>
                </div>
                <div>
                  <dt>Esteiras</dt>
                  <dd>{formatNumber(selected.belts)}</dd>
                </div>
                <div>
                  <dt>Trechos</dt>
                  <dd>{formatNumber(selected.chunks)}</dd>
                </div>
              </dl>
              {canPropose ? (
                <div className={styles.propose}>
                  <label>
                    Motivo
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      minLength={3}
                      maxLength={500}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy || reason.trim().length < 3}
                    onClick={() => void submit()}
                  >
                    {proposeLabel}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </CenteredOverlay>
  )
}
