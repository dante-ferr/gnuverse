'use client'

import { useEffect, useRef, useState } from 'react'
import type { GameApi } from '../api/game-api'
import { isPipelineFrame, type PipelineFrame, type PipelineRules } from '../pipeline/model/frame'
import { FramePreview } from '../preview/frame-preview'
import type { Room } from '../model/types'
import styles from '../game-shell.module.css'

/** Thumbnails refetch at most this often so a page of live cards stays cheap. */
const REFRESH_MS = 3000

/**
 * Change counters for the rooms on a lobby page, fed by one shared SSE stream.
 * Browsers cap HTTP/1.1 connections per host (6 in Chromium), so a stream per
 * card would starve room loads and room creation once a page shows 6+ rooms.
 */
export function useLobbyChanges(api: GameApi, roomIds: string[]) {
  const [versions, setVersions] = useState<Record<string, number>>({})
  const key = roomIds.join(',')
  useEffect(() => {
    if (!key) return
    const stream = api.lobbyStream(key.split(','))
    const onChange = (event: MessageEvent<string>) => {
      try {
        const { roomId } = JSON.parse(event.data) as { roomId?: string }
        if (roomId) setVersions((current) => ({ ...current, [roomId]: (current[roomId] ?? 0) + 1 }))
      } catch { /* ignore malformed events */ }
    }
    stream.addEventListener('change', onChange)
    return () => {
      stream.removeEventListener('change', onChange)
      stream.close()
    }
  }, [api, key])
  return versions
}

/** Room frame while its card is on screen, refetched (throttled) when the layout changes. */
function useRoomFrame(api: GameApi, roomId: string, enabled: boolean, version: number) {
  const [frame, setFrame] = useState<PipelineFrame | null>(null)
  const lastLoadAt = useRef(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = () => {
      lastLoadAt.current = Date.now()
      api.request<{ frame: PipelineFrame }>(`/api/rooms/${encodeURIComponent(roomId)}`)
        .then((result) => {
          if (active && isPipelineFrame(result.frame)) setFrame(result.frame)
        })
        .catch(() => { /* keep the last known frame */ })
    }
    const wait = lastLoadAt.current + REFRESH_MS - Date.now()
    if (wait <= 0) {
      load()
      return () => { active = false }
    }
    const timer = setTimeout(load, wait)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [api, roomId, enabled, version])
  return frame
}

/** True while the element is (nearly) on screen, so off-screen cards hold no stream. */
function useVisible() {
  const ref = useRef<SVGSVGElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { ref, visible }
}

/** Live thumbnail of the area around the room's starting core. */
export function RoomCover({ room, api, rules, version = 0 }: {
  room: Room
  api: GameApi
  rules: PipelineRules | null
  /** Bumped by `useLobbyChanges` when the room's layout changes. */
  version?: number
}) {
  const { ref, visible } = useVisible()
  const frame = useRoomFrame(api, room.id, visible, version)
  return <FramePreview frame={frame} rules={rules} className={styles.roomCover} svgRef={ref} />
}
