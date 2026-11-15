#!/usr/bin/env node
import { parseArgs } from 'node:util'

const baseUrl = process.env.GAME_API_URL ?? 'http://127.0.0.1:3002'

type Json = Record<string, unknown>

async function request(
  path: string,
  options: { method?: string; token?: string; body?: Json } = {},
) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(JSON.stringify(data))
    process.exit(1)
  }
  return data
}

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
    parent: { type: 'string' },
    node: { type: 'string' },
    x: { type: 'string' },
    y: { type: 'string' },
    name: { type: 'string' },
    timeout: { type: 'string' },
    token: { type: 'string' },
  },
})

const command = positionals[0] ?? 'help'
const tokenFile = process.env.GAME_CLI_TOKEN_FILE
let token = values.token ?? process.env.GAME_CLI_TOKEN

async function main() {
  if (command === 'login') {
    const email = values.email ?? process.env.GAME_CLI_EMAIL
    const password = values.password ?? process.env.GAME_CLI_PASSWORD
    if (!email || !password) {
      console.error('Informe --email e --password ou GAME_CLI_EMAIL/GAME_CLI_PASSWORD')
      process.exit(1)
    }
    const data = (await request('/login', {
      body: { email, password },
    })) as { token: string }
    token = data.token
    print({ token: data.token })
    return
  }

  if (!token && command !== 'help') {
    console.error('Faça login primeiro ou defina GAME_CLI_TOKEN')
    process.exit(1)
  }

  switch (command) {
    case 'list': {
      print(await request('/towers', { token: token! }))
      return
    }
    case 'create': {
      print(
        await request('/towers', {
          token: token!,
          body: { name: values.name ?? 'caverna-cli' },
        }),
      )
      return
    }
    case 'status': {
      if (!values.id) {
        console.error('--id obrigatório')
        process.exit(1)
      }
      print(await request(`/towers/${values.id}/status`, { token: token! }))
      return
    }
    case 'grow': {
      if (!values.id || !values.parent || !values.x || !values.y) {
        console.error('--id --parent --x --y obrigatórios')
        process.exit(1)
      }
      print(
        await request(`/towers/${values.id}/grow`, {
          token: token!,
          body: {
            parentId: values.parent,
            x: Number(values.x),
            y: Number(values.y),
          },
        }),
      )
      return
    }
    case 'leaf':
    case 'fortify':
    case 'prune': {
      if (!values.id || !values.node) {
        console.error('--id --node obrigatórios')
        process.exit(1)
      }
      print(
        await request(`/towers/${values.id}/${command}`, {
          token: token!,
          body: { nodeId: values.node },
        }),
      )
      return
    }
    case 'root': {
      if (!values.id || !values.parent || !values.x || !values.y) {
        console.error('--id --parent --x --y obrigatórios')
        process.exit(1)
      }
      print(
        await request(`/towers/${values.id}/root`, {
          token: token!,
          body: {
            parentId: values.parent,
            x: Number(values.x),
            y: Number(values.y),
          },
        }),
      )
      return
    }
    case 'wait': {
      if (!values.id) {
        console.error('--id obrigatório')
        process.exit(1)
      }
      const timeout = Number(values.timeout ?? 60000)
      const start = Date.now()
      const initial = (await request(`/towers/${values.id}/status`, {
        token: token!,
      })) as { phase: string }
      let phase = initial.phase
      while (Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 500))
        const next = (await request(`/towers/${values.id}/status`, {
          token: token!,
        })) as { phase: string; phaseRemainingMs?: number }
        if (next.phase !== phase) {
          print(next)
          return
        }
        phase = next.phase
      }
      console.error('Timeout aguardando mudança de fase')
      process.exit(1)
    }
    default:
      console.error(`Comandos: login, list, create, status, grow, leaf, fortify, prune, root, wait`)
      process.exit(command === 'help' ? 0 : 1)
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})