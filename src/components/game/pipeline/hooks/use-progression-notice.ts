'use client'

import { useEffect, useRef } from 'react'
import type { PipelineFrame } from '../model/frame'

/** Toast when chapter or escalation wave increases (skipped in sandbox). */
export function useProgressionNotice(
  frame: PipelineFrame | null,
  setNotice: (message: string) => void,
  lastChapter = 0,
) {
  const ready = useRef(false)
  const chapter = useRef(0)
  const wave = useRef(0)

  useEffect(() => {
    if (!frame?.seed) return
    const nextChapter = frame.chapter ?? 0
    const nextWave = frame.escalationWave ?? 0
    if (frame.sandbox === true) {
      ready.current = true
      chapter.current = nextChapter
      wave.current = nextWave
      return
    }
    if (!ready.current) {
      ready.current = true
      chapter.current = nextChapter
      wave.current = nextWave
      return
    }
    const chapterUp = nextChapter > chapter.current
    // Onda is only surfaced once the player reaches the last chapter.
    const waveVisible = lastChapter > 0 && nextChapter >= lastChapter
    const waveUp = waveVisible && nextWave > wave.current
    chapter.current = nextChapter
    wave.current = nextWave
    if (!chapterUp && !waveUp) return
    if (chapterUp && waveUp) {
      setNotice(`Capítulo ${nextChapter} · Onda ${nextWave}`)
      return
    }
    if (chapterUp) setNotice(`Capítulo ${nextChapter}`)
    else setNotice(`Onda ${nextWave}`)
  }, [frame?.seed, frame?.sandbox, frame?.chapter, frame?.escalationWave, lastChapter, setNotice])
}