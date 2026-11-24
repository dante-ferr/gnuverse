'use client'

import { useEffect, useRef, useState } from 'react'
import type { GameApi } from '../api/game-api'
import { isPipelineFrame, type PipelineFrame, type PipelineRules } from '../pipeline/model/frame'
import { FramePreview } from '../preview/frame-preview'
import type { Room } from '../model/types'
import styles from '../game-shell.module.css'

type StreamedFrame = PipelineFrame & { omitBelts?: boolean; beltCount?: number }

/** Thumbnails refresh at most this often so a page of live cards stays cheap. */
const REFRESH_MS = 3000

/** Live frame for one room while its card is on screen (SSE, committed in slow batches). */
function useLiveFrame(api: GameApi, roomId: string, enabled: boolean) {
  const [frame, setFrame] = useState<PipelineFrame | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    let latest: PipelineFrame | null = null
    let dirty = false
    const load = () =>
      api.request<{ frame: PipelineFrame }>(`/api/rooms/${encodeURIComponent(roomId)}`)
        .then((result) => {
          if (!active || !isPipelineFrame(result.frame)) return
          if (latest && latest.tick > result.frame.tick) return
          latest = result.frame
          dirty = true
        })
        .catch(() => { /* keep the last known frame */ })
    void load()
    const stream = api.stream(roomId)
    const onFrame = (event: MessageEvent<string>) => {
      if (!active) return
      try {
        const data = JSON.parse(event.data) as StreamedFrame
        if (!isPipelineFrame(data)) return
        if (!data.omitBelts) {
          latest = data
          dirty = true
          return
        }
        const { omitBelts: _omit, beltCount, ...rest } = data
        if (!latest || (beltCount !== undefined && latest.belts.length !== beltCount)) {
          void load()
          return
        }
        latest = { ...rest, belts: latest.belts }
        dirty = true
      } catch { /* ignore malformed frames */ }
    }
    const onChange = () => { if (active) void load() }
    stream.addEventListener('frame', onFrame)
    stream.addEventListener('change', onChange)
    const timer = setInterval(() => {
      if (!dirty || !latest) return
      dirty = false
      setFrame(latest)
    }, REFRESH_MS)
    const first = setTimeout(() => {
      if (dirty && latest) { dirty = false; setFrame(latest) }
    }, 400)
    return () => {
      active = false
      clearInterval(timer)
      clearTimeout(first)
      stream.removeEventListener('frame', onFrame)
      stream.removeEventListener('change', onChange)
      stream.close()
    }
  }, [api, roomId, enabled])
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
export function RoomCover({ room, api, rules }: { room: Room; api: GameApi; rules: PipelineRules | null }) {
  const { ref, visible } = useVisible()
  const frame = useLiveFrame(api, room.id, visible)
  return <FramePreview frame={frame} rules={rules} className={styles.roomCover} svgRef={ref} />
}
