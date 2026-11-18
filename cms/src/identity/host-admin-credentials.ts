const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{3,32}$/u

export type HostAdminCredentials = {
  email: string
  password: string
  name: string
  username: string
}

function requiredEnv(name: string, env: Record<string, string | undefined>): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Configure ${name} no ambiente do CMS.`)
  return value
}

/** Reads and validates HOST_ADMIN_* from the environment. */
export function readHostAdminCredentials(
  env: Record<string, string | undefined> = process.env,
): HostAdminCredentials {
  const email = requiredEnv('HOST_ADMIN_EMAIL', env).toLowerCase()
  const password = requiredEnv('HOST_ADMIN_PASSWORD', env)
  const name = env.HOST_ADMIN_NAME?.trim() || 'Administrador'
  const username = (env.HOST_ADMIN_USERNAME?.trim() || 'Admin').toLowerCase().trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('HOST_ADMIN_EMAIL precisa ser um e-mail válido.')
  }
  if (password.length < 1 || password.length > 128) {
    throw new Error('HOST_ADMIN_PASSWORD precisa ter entre 1 e 128 caracteres.')
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('HOST_ADMIN_USERNAME precisa ter de 3 a 32 letras, números, _ ou -.')
  }
  return { email, password, name, username }
}
