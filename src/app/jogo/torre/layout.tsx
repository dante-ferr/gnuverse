import type { ReactNode } from 'react'

export default function TreeGameLayout({ children }: { children: ReactNode }) {
  return <div className="tree-game-root">{children}</div>
}