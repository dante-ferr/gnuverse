import { withPayload } from '@payloadcms/next/withPayload'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default withPayload({
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
})
