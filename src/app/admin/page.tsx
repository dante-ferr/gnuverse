'use client'

import { useEffect, useState } from 'react'
import { resolveCmsBaseUrl } from '@/lib/cms-client'

/** The editorial panel runs on the CMS, not on the public site. */
export default function AdminRedirectPage() {
  const [cmsUrl, setCmsUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const resolved = resolveCmsBaseUrl()
    setCmsUrl(resolved)
    if (resolved) {
      window.location.replace(`${resolved}/admin`)
    }
  }, [])

  if (cmsUrl === null) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Painel editorial indisponível</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">
          O servidor do CMS ainda não está configurado neste ambiente público
          (<code>NEXT_PUBLIC_CMS_URL</code> ausente).
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p>
        {cmsUrl ? (
          <>
            Abrindo o painel em <a href={`${cmsUrl}/admin`}>{cmsUrl}/admin</a>.
          </>
        ) : (
          'Localizando painel administrativo…'
        )}
      </p>
    </main>
  )
}