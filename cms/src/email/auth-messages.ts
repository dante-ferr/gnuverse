import { getSiteURL } from './site-url'

function escapeHTML(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function verificationEmailHTML(args?: { token?: string; user?: { email?: string } }) {
  const token = args?.token ?? ''
  const email = args?.user?.email ?? ''
  const url = `${getSiteURL()}/verificar-email/?token=${encodeURIComponent(token)}`
  return `<!doctype html>
<html lang="pt-BR">
  <body>
    <p>Olá, ${escapeHTML(email)}.</p>
    <p>Confirme seu endereço de e-mail para usar o GNUverse:</p>
    <p><a href="${url}">${url}</a></p>
  </body>
</html>`
}

export function forgotPasswordEmailHTML(args?: { token?: string; user?: { email?: string } }) {
  const token = args?.token ?? ''
  const email = args?.user?.email ?? ''
  const url = `${getSiteURL()}/redefinir-senha/?token=${encodeURIComponent(token)}`
  return `<!doctype html>
<html lang="pt-BR">
  <body>
    <p>Olá, ${escapeHTML(email)}.</p>
    <p>Recebemos um pedido para redefinir sua senha no GNUverse:</p>
    <p><a href="${url}">${url}</a></p>
    <p>Se você não solicitou isso, ignore este e-mail.</p>
  </body>
</html>`
}