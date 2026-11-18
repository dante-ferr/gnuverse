import type { ServerProps } from 'payload'
import { can } from '../../../core/authz/policy.ts'
import { cmsActor } from '../access'

export function ChatModerationLink({ user }: ServerProps) {
  if (!can(cmsActor(user), 'room:chat:moderate')) return null
  return (
    <a href="/moderacao-chat" style={{ display: 'block', padding: '12px 0', fontWeight: 600 }}>
      Moderação do chat ↗
    </a>
  )
}
