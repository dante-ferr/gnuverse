import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { can } from '../../../../../core/authz/policy.ts'
import { cmsActor } from '../../../access'
import { ChatModerationPanel } from '../../../chat-moderation/ChatModerationPanel'

export const metadata = { title: 'Moderação do chat · GNUverse' }

export default async function ChatModerationPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login?redirect=%2Fmoderacao-chat')
  if (!can(cmsActor(user), 'room:chat:moderate')) {
    return (
      <main style={{ padding: '3rem' }}>
        <h1>Acesso restrito</h1>
        <p>Apenas administradores e moderadores do jogo podem moderar o chat das salas.</p>
        <a href="/admin">Voltar ao painel</a>
      </main>
    )
  }
  return <ChatModerationPanel />
}
