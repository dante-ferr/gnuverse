import config from '@payload-config'
import '@payloadcms/next/css'
import type { Metadata } from 'next'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { importMap } from './admin/importMap.js'

export const viewport = { width: 'device-width', initialScale: 1 }
// O painel já tem tema próprio. Evita que o Dark Reader altere o HTML antes da hidratação.
export const metadata: Metadata = { other: { 'darkreader-lock': 'true' } }
const serverFunction: ServerFunctionClient = async (args) => {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>{children}</RootLayout>
}
