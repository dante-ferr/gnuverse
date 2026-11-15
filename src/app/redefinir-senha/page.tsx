import { Suspense } from 'react'
import { AccountRecoveryPage } from '@/components/game/account/account-recovery-page'

export const metadata = {
  title: 'Redefinir senha — GNUverse',
  description: 'Defina uma nova senha para sua conta GNUverse.',
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
    <AccountRecoveryPage
      mode="reset"
      title="Redefinir senha"
      description="Escolha uma nova senha para a sua conta."
    />
    </Suspense>
  )
}