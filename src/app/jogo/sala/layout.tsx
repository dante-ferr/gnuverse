import type { ReactNode } from 'react'

export default function PipelineRoomLayout({ children }: { children: ReactNode }) {
  return <div className="pipeline-game-root">{children}</div>
}