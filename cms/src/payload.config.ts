import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor, LinkFeature } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { pt } from '@payloadcms/translations/languages/pt'
import sharp from 'sharp'
import { Users } from './collections/Users'
import { Articles } from './collections/Articles'
import { Media } from './collections/Media'
import { getLocalCMSURL, loadLocalEnvironment } from '../scripts/local-config.mjs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const postgres = process.env.DATABASE_ADAPTER === 'postgres'
const s3 = process.env.STORAGE_ADAPTER === 's3'
if (process.env.NODE_ENV !== 'production') loadLocalEnvironment()
const serverURL = process.env.NODE_ENV === 'production'
  ? required('CMS_SERVER_URL')
  : getLocalCMSURL()

if (!process.env.PAYLOAD_SECRET) throw new Error('Configure PAYLOAD_SECRET no ambiente do CMS.')
if (process.env.NODE_ENV === 'production' && (!postgres || !s3)) {
  throw new Error('Produção exige DATABASE_ADAPTER=postgres e STORAGE_ADAPTER=s3 para preservar dados e uploads.')
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Configure ${name} no ambiente do CMS.`)
  return value
}

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET,
  serverURL,
  admin: { user: 'users', importMap: { baseDir: dirname } },
  i18n: { supportedLanguages: { pt }, fallbackLanguage: 'pt' },
  collections: [Users, Articles, Media],
  editor: lexicalEditor({ features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter((feature) => !['link', 'upload', 'relationship'].includes(feature.key)),
    // Apenas links externos e capa: nenhuma mídia do corpo dependerá do CMS no navegador.
    LinkFeature({ enabledCollections: [] }),
  ] }),
  db: postgres
    ? postgresAdapter({ pool: { connectionString: required('DATABASE_URL') }, push: false, migrationDir: path.resolve(dirname, 'migrations') })
    : sqliteAdapter({ client: { url: process.env.DATABASE_URL || 'file:./data/gnuverse.db' } }),
  plugins: s3 ? [s3Storage({
    collections: { media: true },
    bucket: required('S3_BUCKET'),
    config: {
      endpoint: required('S3_ENDPOINT'), region: required('S3_REGION'), forcePathStyle: true,
      credentials: { accessKeyId: required('S3_ACCESS_KEY_ID'), secretAccessKey: required('S3_SECRET_ACCESS_KEY') },
    },
  })] : [],
  sharp,
  upload: { limits: { fileSize: 5 * 1024 * 1024 } },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
