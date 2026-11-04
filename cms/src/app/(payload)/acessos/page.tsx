import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { can } from '../../../../../core/authz/policy.ts'
import { cmsActor } from '../../../access'
import { AccessManager } from '../../../access-management/AccessManager'

export const metadata = { title: 'Pessoas e acessos · GNUverse' }
export default async function AccessPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login?redirect=%2Facessos')
  if (!can(cmsActor(user), 'roles:manage')) return <main style={{ padding: '3rem' }}>
    <h1>Acesso restrito</h1><p>Apenas administradores podem gerenciar pessoas e papéis.</p><a href="/admin">Voltar ao painel</a>
  </main>
  return <AccessManager />
}
