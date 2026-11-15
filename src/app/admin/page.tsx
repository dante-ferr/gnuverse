'use client'

import { useEffect } from 'react'

const cmsURL = (process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3001').replace(/\/$/, '')

/** The editorial panel runs on the CMS, not on the public site. */
export default function AdminRedirectPage() {
  useEffect(() => {
    window.location.replace(`${cmsURL}/admin`)
  }, [])

  return (
    <main>
      <p>
        Abrindo o painel em <a href={`${cmsURL}/admin`}>{cmsURL}/admin</a>.
      </p>
    </main>
  )
}