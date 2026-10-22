import type { IncomingMessage, ServerResponse } from 'node:http'
import { fail } from '../domain/validation.ts'

export const json = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}
export const readBody = async (
  req: IncomingMessage,
): Promise<Record<string, unknown>> => {
  if (
    !(req.headers['content-type'] ?? '')
      .toLowerCase()
      .startsWith('application/json')
  )
    fail(415, 'Envie JSON.')
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 16384) fail(413, 'Pedido muito grande.')
    chunks.push(chunk)
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString())
    if (!body || Array.isArray(body) || typeof body !== 'object')
      fail(400, 'JSON inválido.')
    return body
  } catch {
    fail(400, 'JSON inválido.')
  }
}
