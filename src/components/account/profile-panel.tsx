'use client'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useGameSession } from '@/components/game/hooks/use-game-session'
import {
  fetchOwnProfile,
  removeOwnAvatar,
  updateOwnAboutBio,
  uploadOwnAvatar,
  validateAvatarFile,
  type UserProfile,
} from '@/lib/profile-client'

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'GN'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function ProfilePanel() {
  const session = useGameSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingBio, setSavingBio] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!session.token) {
      setProfile(null)
      setBioDraft('')
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    void fetchOwnProfile(session.token)
      .then((loaded) => {
        if (!active) return
        setProfile(loaded)
        setBioDraft(loaded?.aboutBio ?? '')
      })
      .catch((cause) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível carregar os dados do perfil.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session.token])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !session.token) return

    const validationError = validateAvatarFile(file)
    if (validationError) {
      setNotice('')
      setError(validationError)
      return
    }

    setUploading(true)
    setError('')
    setNotice('')
    try {
      const updated = await uploadOwnAvatar(session.token, file)
      setProfile(updated)
      await session.refreshProfile()
      setNotice('Foto de perfil atualizada com sucesso.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível enviar a foto de perfil.',
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveAvatar() {
    if (!session.token) return
    setUploading(true)
    setError('')
    setNotice('')
    try {
      const updated = await removeOwnAvatar(session.token)
      setProfile(updated)
      await session.refreshProfile()
      setNotice('Foto de perfil removida.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível remover a foto de perfil.',
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleBioSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session.token) return
    setSavingBio(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateOwnAboutBio(session.token, bioDraft)
      setProfile(updated)
      setBioDraft(updated.aboutBio ?? '')
      setNotice('Descrição atualizada com sucesso.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar a descrição.',
      )
    } finally {
      setSavingBio(false)
    }
  }

  if (!session.token) {
    return (
      <section className="mt-10 rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
          Entre na sua conta
        </h2>
        <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-[var(--muted)]">
          Para escolher ou alterar sua foto de perfil no GNUverse, faça login
          primeiro com sua conta.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/login/?next=%2Fperfil%2F"
            className="inline-flex items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] transition hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
          >
            Entrar na conta
          </Link>
          <Link
            href="/cadastro/?next=%2Fperfil%2F"
            className="inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--muted)]"
          >
            Criar conta
          </Link>
        </div>
      </section>
    )
  }

  const displayName = profile?.name || session.user?.nickname || 'Sua conta'
  const avatarUrl = profile?.avatar?.url ?? session.avatarUrl

  return (
    <div className="mt-10 space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-[var(--secondary)] bg-[var(--secondary-soft)] px-4 py-3 text-sm text-[var(--secondary)]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]"
        >
          {notice}
        </p>
      )}

      <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">
          Foto de perfil
        </h2>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          Sua foto aparece no cabeçalho quando você está conectado
          {profile?.showOnAbout ? ' e no seu card da página Sobre.' : '.'}
        </p>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="aspect-square h-28 w-28 shrink-0 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-raised)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`Foto de perfil de ${displayName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center font-mono text-xl font-medium text-[var(--accent)]"
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>

          <div className="flex-1">
            <p className="text-base font-semibold text-[var(--ink)]">
              {displayName}
            </p>
            {profile?.username && (
              <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                @{profile.username}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Escolher foto de perfil"
              onChange={(event) => void handleFileChange(event)}
              disabled={uploading || loading}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={uploading || loading}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] transition hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'Enviando…' : avatarUrl ? 'Alterar foto' : 'Enviar foto'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  disabled={uploading || loading}
                  onClick={() => void handleRemoveAvatar()}
                  className="cursor-pointer rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remover foto
                </button>
              )}
            </div>

            <p className="mt-3 text-xs text-[var(--muted)]">
              Formatos aceitos: JPEG, PNG ou WebP. Tamanho máximo: 2 MB.
            </p>
          </div>
        </div>
      </section>

      {profile?.showOnAbout && (
        <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">
            Descrição na página Sobre
          </h2>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Sua conta está listada em{' '}
            <Link
              href="/sobre/"
              className="text-[var(--accent)] underline underline-offset-4"
            >
              /sobre/
            </Link>
            . Você pode atualizar sua apresentação curta abaixo.
          </p>

          <form onSubmit={(event) => void handleBioSubmit(event)} className="mt-5">
            <label
              htmlFor="profile-about-bio"
              className="block text-xs font-medium text-[var(--muted)]"
            >
              Descrição curta (opcional, até 300 caracteres)
            </label>
            <textarea
              id="profile-about-bio"
              value={bioDraft}
              onChange={(event) => setBioDraft(event.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Conte brevemente sua participação no GNUverse…"
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
                {bioDraft.length}/300
              </span>
              <button
                type="submit"
                disabled={savingBio}
                className="cursor-pointer rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingBio ? 'Salvando…' : 'Salvar descrição'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
