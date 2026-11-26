import type { IncomingMessage, ServerResponse } from 'node:http'
import { gzipSync } from 'node:zlib'
import { fail } from '../domain/validation.ts'

/** Extracts the client IP behind a reverse proxy (e.g. Render), falling back to the socket peer. */
export const clientAddress = (req: IncomingMessage): string => {
  const forwarded = req.headers['x-forwarded-for']
  const forwardedRaw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const firstForwarded = forwardedRaw?.split(',')[0]?.trim()
  if (firstForwarded) return firstForwarded
  const realIp = req.headers['x-real-ip']
  const realIpRaw = (Array.isArray(realIp) ? realIp[0] : realIp)?.trim()
  if (realIpRaw) return realIpRaw
  return req.socket?.remoteAddress || 'unknown'
}

/** Bodies smaller than this are not worth compressing. */
const GZIP_MIN_BYTES = 2048

export const json = (res: ServerResponse, status: number, value: unknown) => {
  const body = JSON.stringify(value)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  // Room detail carries every belt and the event log; it compresses roughly tenfold.
  const accepts = String(res.req?.headers['accept-encoding'] ?? '')
  if (body.length >= GZIP_MIN_BYTES && /\bgzip\b/.test(accepts)) {
    const vary = res.getHeader('Vary')
    res.writeHead(status, {
      ...headers,
      'Content-Encoding': 'gzip',
      Vary: vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding',
    })
    res.end(gzipSync(body, { level: 4 }))
    return
  }
  res.writeHead(status, headers)
  res.end(body)
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
