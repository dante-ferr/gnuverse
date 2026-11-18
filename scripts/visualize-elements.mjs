#!/usr/bin/env node
/**
 * Compatibility entry point. Prefer:
 *   npm run elements:serve
 *   npm run elements:build
 */
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] === 'serve'
  ? join(root, 'scripts/elements/serve.mjs')
  : join(root, 'scripts/elements/build.mjs')

const result = spawnSync(process.execPath, [target, ...process.argv.slice(3)], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
