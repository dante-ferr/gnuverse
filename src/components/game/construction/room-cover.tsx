'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { GameApi } from '../api/game-api'
import { CombinerMachine } from '../../../../game-server/pipeline/machines/combiner-machine.ts'
import { TrashcanMachine } from '../../../../game-server/pipeline/machines/trashcan-machine.ts'
import { CoreMachine } from '../../../../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../../../../game-server/pipeline/machines/source-machine.ts'
import { darkenHex } from '../pipeline/scene/painters/darken-hex'
import { glyphUrlForShape, isPipelineFrame, type PipelineFrame, type PipelineRules, type SourceRecord } from '../pipeline/model/frame'
import type { Room } from '../model/types'
import styles from '../game-shell.module.css'

const VIEW_W = 320
const VIEW_H = 194
const FALLBACK_VIEW_CELLS = 32

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

const CELL_PX = 48 // matches the room scene's world cell size (grid-painter)
const CORE_FRAME = '/pipeline/core-frame.svg'
const CORE_GEAR_OUTER = '/pipeline/core-gear-outer.svg'
const CORE_GEAR_INNER = '/pipeline/core-gear-inner.svg'
const GEAR_OUTER_SCALE = 0.74
const GEAR_INNER_SCALE = 0.48

/** Solid-color shape cut from an SVG glyph (same tinting the room scene uses). */
function Tinted({ id, href, x, y, w, h, fill }: {
  id: string; href: string; x: number; y: number; w: number; h: number; fill: string
}) {
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
        <image href={href} x={x} y={y} width={w} height={h} />
      </mask>
      <rect x={x} y={y} width={w} height={h} fill={fill} mask={`url(#${id})`} />
    </>
  )
}

/**
 * Mirrors the room scene's most zoomed-out LOD (`machines: 'cores'`): plain belt
 * tracks, outlined disk packets, core bodies with gears, and source glyphs only.
 */
function Scene({ frame, rules, uid }: { frame: PipelineFrame; rules: PipelineRules | null; uid: string }) {
  const viewCells = rules?.lobbyThumbnailViewCells ?? FALLBACK_VIEW_CELLS
  const px = Math.min(VIEW_W, VIEW_H) / viewCells
  const core = frame.core
  const left = core.x + CoreMachine.size / 2 - VIEW_W / px / 2
  const top = core.y + CoreMachine.size / 2 - VIEW_H / px / 2
  const right = left + VIEW_W / px
  const bottom = top + VIEW_H / px
  const inView = (x: number, y: number, w = 1, h = 1) =>
    x + w >= left && x <= right && y + h >= top && y <= bottom
  const beltColor = rules?.colorBelt ?? '#667b83'
  const fastColor = rules?.colorFastBelt ?? beltColor
  const coreColor = rules?.colorCore ?? '#ffffff'
  const outlineColor = rules?.colorOutline ?? '#000000'
  const accent = rules?.colorAccent ?? '#52d6c9'
  const darken = rules?.decorDarkenPercent ?? 40
  const outlineW = (rules?.outlineWidthPx ?? 2) / px
  const fillFor = (shape: string) =>
    rules?.elements.elements.find((item) => item.id === shape)?.fill ?? rules?.colorPacket ?? '#52d6c9'
  const wallPx = (n: number) => n / px
  const beltW = 0.88
  const tunnelColor = rules?.colorTunnel ?? beltColor
  const plate = (key: string, x: number, y: number, w: number, h: number, fill: string) => (
    <rect key={key} x={x} y={y} width={w} height={h} fill={fill} stroke={outlineColor}
      strokeWidth={Math.max(1, (rules?.outlineWidthPx ?? 2) * 0.75) / px} />
  )
  const cores = frame.cores?.length ? frame.cores : [core]
  const sources: SourceRecord[] = frame.sources?.length ? frame.sources : [frame.source]
  const glyphSize = rules
    ? rules.resourceGlyphSizePx / (rules.resourceGlyphWorldMinZoom > 0 ? rules.resourceGlyphWorldMinZoom : 1) / CELL_PX
    : 0.6
  return (
    <g transform={`scale(${px}) translate(${-left} ${-top})`}>
      {frame.belts.filter((belt) => inView(belt.x, belt.y)).map((belt) => {
        const horizontal = belt.direction === 'east' || belt.direction === 'west'
        const fast = rules ? (belt.speed ?? 1) === rules.beltSpeedFast : false
        return (
          <rect key={belt.id}
            x={horizontal ? belt.x : belt.x + (1 - beltW) / 2}
            y={horizontal ? belt.y + (1 - beltW) / 2 : belt.y}
            width={horizontal ? 1 : beltW} height={horizontal ? beltW : 1}
            fill={fast ? fastColor : beltColor} />
        )
      })}
      {(frame.tunnels ?? []).filter((item) => inView(item.x, item.y)).map((item) =>
        plate(item.id, item.x, item.y, 1, 1, (item.speed ?? 1) > 1 ? rules?.colorFastTunnel ?? tunnelColor : tunnelColor))}
      {(frame.splitters ?? []).filter((item) => inView(item.x, item.y)).map((item) =>
        plate(item.id, item.x, item.y, 1, 1, rules?.colorSplitter ?? beltColor))}
      {(frame.trashcans ?? []).filter((item) => inView(item.x, item.y, TrashcanMachine.width, TrashcanMachine.height)).map((item) =>
        plate(item.id, item.x, item.y, TrashcanMachine.width, TrashcanMachine.height, rules?.colorTrashcan ?? beltColor))}
      {(frame.combiners ?? []).map((item) => {
        const { width, height } = CombinerMachine.sizeFor(item.machineId, item.facing)
        return inView(item.x, item.y, width, height)
          ? plate(item.id, item.x, item.y, width, height,
              rules?.elements.machines.find((machine) => machine.id === item.machineId)?.color ?? accent)
          : null
      })}
      {cores.filter((item) => inView(item.x, item.y, CoreMachine.size, CoreMachine.size)).map((item, index) => {
        const size = CoreMachine.size
        const cx = item.x + size / 2
        const cy = item.y + size / 2
        const outer = size * GEAR_OUTER_SCALE
        const inner = size * GEAR_INNER_SCALE
        return (
          <g key={item.id}>
            <rect x={item.x} y={item.y} width={size} height={size} fill={coreColor}
              stroke={outlineColor} strokeWidth={outlineW} />
            <Tinted id={`${uid}-f${index}`} href={CORE_FRAME} x={item.x} y={item.y} w={size} h={size}
              fill={darkenHex(coreColor, darken)} />
            <Tinted id={`${uid}-o${index}`} href={CORE_GEAR_OUTER} x={cx - outer / 2} y={cy - outer / 2}
              w={outer} h={outer} fill={accent} />
            <Tinted id={`${uid}-i${index}`} href={CORE_GEAR_INNER} x={cx - inner / 2} y={cy - inner / 2}
              w={inner} h={inner} fill={darkenHex(accent, darken)} />
          </g>
        )
      })}
      {sources.filter((item) => inView(item.x, item.y, SourceMachine.size, SourceMachine.size)).map((item, index) => {
        const glyphId = item.role ?? item.shape
        const href = glyphUrlForShape(rules, glyphId)
        const cx = item.x + SourceMachine.size / 2
        const cy = item.y + SourceMachine.size / 2
        const fill = fillFor(glyphId)
        return href && glyphId !== 'circle'
          ? <Tinted key={item.id} id={`${uid}-s${index}`} href={href} x={cx - glyphSize / 2} y={cy - glyphSize / 2}
              w={glyphSize} h={glyphSize} fill={fill} />
          : <circle key={item.id} cx={cx} cy={cy} r={glyphSize / 2} fill={fill}
              stroke={rules?.resourceGlyphOutlineInner ?? outlineColor} strokeWidth={wallPx(1)} />
      })}
    </g>
  )
}

/** Live thumbnail of the area around the room's starting core. */
export function RoomCover({ room, api, rules }: { room: Room; api: GameApi; rules: PipelineRules | null }) {
  const { ref, visible } = useVisible()
  const uid = useId().replace(/:/g, '')
  const frame = useLiveFrame(api, room.id, visible)
  return (
    <svg ref={ref} className={styles.roomCover} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true"
      preserveAspectRatio="xMidYMid slice">
      <rect width={VIEW_W} height={VIEW_H} fill={rules?.colorBackground ?? 'var(--scene)'} />
      {frame ? <Scene frame={frame} rules={rules} uid={uid} /> : null}
    </svg>
  )
}
