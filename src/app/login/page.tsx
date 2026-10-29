import { AuthPage } from '@/components/game/account/auth-page'

export const metadata = {
  title: 'Entrar — GNUverse',
  description: 'Entre na sua conta GNUverse para construir com a comunidade.',
}

export default function LoginPage() {
  return <AuthPage key="login" mode="login" />
}
