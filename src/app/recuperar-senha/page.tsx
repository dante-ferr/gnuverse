import { Suspense } from 'react'
import { AccountRecoveryPage } from '@/components/game/account/account-recovery-page'

export const metadata = {
  title: 'Recuperar senha — GNUverse',
  description: 'Solicite um link por e-mail para redefinir sua senha no GNUverse.',
}

export default function RecoverPasswordPage() {
  return (
    <Suspense fallback={null}>
    <AccountRecoveryPage
      mode="forgot"
      title="Recuperar senha"
      description="Informe o e-mail da sua conta. Se ele estiver cadastrado, você receberá um link para redefinir a senha."
    />
    </Suspense>
  )
}