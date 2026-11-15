import { Suspense } from 'react'
import { AccountRecoveryPage } from '@/components/game/account/account-recovery-page'

export const metadata = {
  title: 'Confirmar e-mail — GNUverse',
  description: 'Confirme seu endereço de e-mail para usar o GNUverse.',
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
    <AccountRecoveryPage
      mode="verify"
      title="Confirmar e-mail"
      description="Estamos validando o link que você recebeu por e-mail."
    />
    </Suspense>
  )
}