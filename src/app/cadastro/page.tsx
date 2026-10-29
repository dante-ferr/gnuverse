import { AuthPage } from '@/components/game/account/auth-page'

export const metadata = {
  title: 'Criar conta — GNUverse',
  description: 'Crie sua conta GNUverse e participe das torres colaborativas.',
}

export default function RegisterPage() {
  return <AuthPage key="register" mode="register" />
}
