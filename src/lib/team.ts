import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'
import { getContent } from './articles'

export type TeamMember = {
  id: string
  name: string
  bio?: string
  photo?: {
    url: string
    alt: string
  }
  order?: number
}

export const getTeamContent = cache(
  async (): Promise<{ mode: 'demo' | 'live'; members: TeamMember[] }> => {
    try {
      const content = await getContent()
      if (Array.isArray(content.teamMembers)) {
        return { mode: content.mode, members: content.teamMembers }
      }
    } catch {
      // Fall back to local demo team when the static snapshot is unavailable.
    }

    try {
      const raw = await readFile(
        path.join(process.cwd(), 'content/demo-team.json'),
        'utf8',
      )
      const parsed = JSON.parse(raw)
      return {
        mode: 'demo',
        members: Array.isArray(parsed) ? (parsed as TeamMember[]) : [],
      }
    } catch {
      return { mode: 'demo', members: [] }
    }
  },
)
