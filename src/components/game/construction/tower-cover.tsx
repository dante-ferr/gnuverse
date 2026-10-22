'use client'

import { useEffect, useState } from 'react'
import type { GameApi } from '../api/game-api'
import type { Block, Tower, TowerState } from '../model/types'
import { Blocks } from './block-shapes'
import styles from '../tower-game.module.css'

/** Older list responses omit geometry; fetch it only for cards on this page. */
export function TowerCover({ tower, api }: { tower: Tower; api: GameApi }) {
  const [blocks, setBlocks] = useState<Block[] | null>(tower.coverBlocks ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setFailed(false)
    if (tower.coverBlocks !== undefined) {
      setBlocks(tower.coverBlocks)
    } else {
      void api.request<TowerState>(`/api/towers/${encodeURIComponent(tower.id)}`)
        .then((state) => {
          if (active) setBlocks(state.frame.blocks)
        })
        .catch(() => {
          if (active) setFailed(true)
        })
    }
    return () => { active = false }
  }, [api, tower])

  const visibleBlocks = tower.coverBlocks ?? blocks
  const message = failed ? 'Prévia indisponível' : visibleBlocks === null
    ? 'Carregando prévia…' : visibleBlocks.length === 0 ? 'Pronta para construir' : ''

  return (
    <svg
      className={styles.towerCover}
      viewBox="0 0 1000 800"
      role="img"
      aria-label={message || `Estado atual de ${tower.name}: ${visibleBlocks?.length} blocos`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width="1000" height="800" fill="var(--scene)" />
      <rect y="740" width="1000" height="60" fill="var(--ground)" />
      <line x1="0" y1="740" x2="1000" y2="740" stroke="var(--ground-edge)" strokeWidth="4" />
      <Blocks blocks={visibleBlocks ?? []} />
      {message && <text x="500" y="390" textAnchor="middle" fill="var(--muted)" fontSize="30">{message}</text>}
    </svg>
  )
}
