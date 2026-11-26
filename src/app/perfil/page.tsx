import { ProfilePanel } from '@/components/account/profile-panel'

export const metadata = {
  title: 'Perfil — GNUverse',
  description: 'Gerencie sua foto de perfil e apresentação na sua conta GNUverse.',
}

export default function ProfilePage() {
  return (
    <main className="[overflow-wrap:anywhere] mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-12">
      <header className="border-b border-[var(--line)] pt-2 pb-8">
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
          Seu perfil
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-[var(--muted)]">
          Personalize sua foto de perfil exibida na sua conta GNUverse.
        </p>
      </header>
      <ProfilePanel />
    </main>
  )
}
