'use client'

import { useEffect, useState } from 'react'
import { ROLES, type Role } from '../../../core/authz/policy'
import type { RoleEntry } from '../../../core/authz/file-role-store'
import type { RoleRegistry } from '../../../core/authz/manage-role-store'
import type { AccountOption } from './endpoints'
import styles from './access-manager.module.css'

const roleDetails: Record<Role, { name: string; description: string }> = {
  admin: { name: 'Administrador', description: 'Gerencia pessoas e todos os domínios do site.' },
  'blog-editor': { name: 'Editor do blog', description: 'Edita e publica artigos; envia e edita imagens.' },
  'game-moderator': { name: 'Moderador do jogo', description: 'Edita, restaura e exclui qualquer torre.' },
  'quiz-editor': { name: 'Editor de quizzes', description: 'Permissão preparada para a futura área de quizzes.' },
  member: { name: 'Membro', description: 'Participa do jogo e administra as próprias torres.' },
}
const blankEntry = (): RoleEntry => ({ id: '', name: '', roles: ['member'], identities: [] })
type Directory = { accounts: AccountOption[]; gameError?: string }

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/access-management${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.')
  return data
}

export function AccessManager() {
  const [registry, setRegistry] = useState<RoleRegistry | null>(null)
  const [directory, setDirectory] = useState<Directory>({ accounts: [] })
  const [entry, setEntry] = useState<RoleEntry>(blankEntry)
  const [search, setSearch] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void Promise.all([request<RoleRegistry>(''), request<Directory>('/accounts')]).then(([roles, accounts]) => {
      if (!active) return
      setRegistry(roles)
      setDirectory(accounts)
      setEntry(blankEntry())
      setDirty(false)
    }).catch((reason: Error) => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  function selectEntry(value: RoleEntry) {
    if (dirty && !window.confirm('Descartar as alterações não salvas?')) return
    setEntry(structuredClone(value)); setAccountSearch(''); setDirty(false); setError(''); setNotice('')
    document.getElementById('access-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  function updateEntry(changes: Partial<RoleEntry>) { setEntry((current) => ({ ...current, ...changes })); setDirty(true) }
  async function mutate(body: Record<string, unknown>, message: string) {
    if (!registry) return
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await request<RoleRegistry>('', { ...body, revision: registry.revision })
      setRegistry(updated); setEntry(blankEntry()); setDirty(false); setNotice(message)
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy(false) }
  }
  const entries = registry?.entries ?? []
  const administratorCount = entries.filter((person) => person.roles.includes('admin') && person.identities.some((identity) => identity.provider === 'cms')).length
  const searchText = search.toLocaleLowerCase('pt-BR').trim()
  const visibleEntries = entries.filter((person) => `${person.name || person.id} ${person.roles.map((role) => roleDetails[role].name).join(' ')} ${person.identities.map((identity) => {
    const account = directory.accounts.find((account) => account.provider === identity.provider && account.id === identity.id)
    return account ? `${account.name} ${account.email}` : ''
  }).join(' ')}`.toLocaleLowerCase('pt-BR').includes(searchText))
  const lastAdministrator = (person: RoleEntry) => administratorCount === 1 && person.roles.includes('admin') && person.identities.some((identity) => identity.provider === 'cms')
  const accountLabel = (provider: string, id: string) => {
    const account = directory.accounts.find((account) => account.provider === provider && account.id === id)
    return account ? `${account.name} · ${account.email}` : `Conta indisponível · ${id}`
  }

  return <main className={styles.page}>
    <a className={styles.back} href="/admin">← Painel do GNUverse</a>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>ADMINISTRAÇÃO DO SITE</p><h1>Pessoas e acessos</h1>
        <p>Escolha quem pode administrar o blog, o jogo e os futuros quizzes.</p></div>
      <button type="button" className={styles.secondary} disabled={loading || busy} onClick={() => {
        if (!dirty || window.confirm('Recarregar e descartar as alterações não salvas?')) setReload((value) => value + 1)
      }}>Recarregar lista</button>
    </header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    {loading && <p role="status">Carregando pessoas e contas…</p>}
    {!loading && registry && !registry.enabled && <section className={styles.activation}>
      <span className={styles.eyebrow}>CONFIGURAÇÃO INICIAL</span>
      <h2>Um só lugar para gerenciar os acessos</h2>
      <p>Ative a gestão compartilhada para vincular contas e definir papéis nesta tela. Os administradores e editores atuais do blog serão preservados.</p>
      <p>Depois, selecione as contas do jogo que pertencem a cada pessoa. Contas com o mesmo e-mail não são vinculadas automaticamente.</p>
      <button type="button" disabled={busy} onClick={() => void mutate({ action: 'initialize' }, 'Gestão compartilhada ativada. Os acessos existentes do blog foram preservados.')}>{busy ? 'Ativando…' : 'Ativar gestão compartilhada'}</button>
    </section>}
    {!loading && registry?.enabled && <>
      <div className={styles.summary}>
        <span><strong>{entries.length}</strong> {entries.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}</span>
        <span><strong>{administratorCount}</strong> {administratorCount === 1 ? 'administrador do painel' : 'administradores do painel'}</span>
        <span className={styles.active}>● Gestão compartilhada ativa</span>
      </div>
      {directory.gameError && <p className={styles.warning} role="status">{directory.gameError}</p>}
      <div className={styles.layout}>
        <section className={styles.people} aria-labelledby="people-heading">
          <div className={styles.sectionHeading}><h2 id="people-heading">Pessoas</h2><button type="button" className={styles.secondary} disabled={busy} onClick={() => selectEntry(blankEntry())}>+ Nova pessoa</button></div>
          <label className={styles.search}>Buscar pessoa<input type="search" placeholder="Nome, conta ou papel" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className={styles.list}>
            {!visibleEntries.length && <p className={styles.empty}>{entries.length ? 'Nenhuma pessoa corresponde à busca.' : 'Cadastre a primeira pessoa para atribuir seus papéis.'}</p>}
            {visibleEntries.map((person) => <article className={`${styles.person} ${entry.id === person.id ? styles.selected : ''}`} key={person.id}>
              <div className={styles.personHeading}><h3>{person.name || 'Pessoa sem nome'}</h3>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => selectEntry(person)}>Editar<span className={styles.srOnly}> {person.name || 'pessoa'}</span></button></div>
              <div className={styles.badges}>{person.roles.length ? person.roles.map((role) => <span key={role}>{roleDetails[role].name}</span>) : <span>Sem papéis adicionais</span>}</div>
              <ul className={styles.identities}>{person.identities.map((identity) => <li key={`${identity.provider}:${identity.id}`}><strong>{identity.provider === 'cms' ? 'Blog / painel' : identity.provider === 'game' ? 'Jogo' : identity.provider}</strong><span>{accountLabel(identity.provider, identity.id)}</span></li>)}</ul>
            </article>)}
          </div>
        </section>
        <section className={styles.editor} id="access-editor" aria-labelledby="editor-heading">
          <div className={styles.sectionHeading}><h2 id="editor-heading">{entry.id ? 'Editar pessoa' : 'Nova pessoa'}</h2>{dirty && <small>Não salvo</small>}</div>
          <form onSubmit={(event) => { event.preventDefault(); void mutate({ action: 'save', entry }, 'Pessoa e acessos salvos.') }}>
            <fieldset disabled={busy} className={styles.fields}>
              <label>Nome da pessoa<input required maxLength={120} value={entry.name || ''} onChange={(event) => updateEntry({ name: event.target.value })} placeholder="Como você identifica esta pessoa" /></label>
              <fieldset className={styles.roles}><legend>Papéis</legend>{ROLES.map((role) => <label key={role} className={styles.role}>
                <input type="checkbox" checked={entry.roles.includes(role)} disabled={role === 'admin' && lastAdministrator(entry)} onChange={(event) => updateEntry({ roles: event.target.checked ? [...entry.roles, role] : entry.roles.filter((value) => value !== role) })} />
                <span><strong>{roleDetails[role].name}</strong><small>{roleDetails[role].description}</small></span>
              </label>)}</fieldset>
              <fieldset className={styles.accounts}><legend>Contas vinculadas</legend><p>Vincule somente contas da mesma pessoa. Os papéis acima valem para todas elas.</p>
                <label>Buscar conta<input type="search" value={accountSearch} placeholder="Nome ou e-mail" onChange={(event) => setAccountSearch(event.target.value)} /></label>
                {(['cms', 'game'] as const).map((provider) => {
                  const options = directory.accounts.filter((account) => account.provider === provider)
                  for (const identity of entry.identities.filter((identity) => identity.provider === provider)) {
                    if (!options.some((account) => account.id === identity.id)) options.push({ provider, id: identity.id, name: `Conta indisponível · ${identity.id}`, email: '' })
                  }
                  return <label key={provider}>{provider === 'cms' ? 'Blog / painel' : 'Jogo'}
                    <select multiple size={4} aria-describedby="account-help" value={entry.identities.filter((identity) => identity.provider === provider).map((identity) => identity.id)} onChange={(event) => {
                      const visibleIds = new Set(Array.from(event.target.options).map((option) => option.value))
                      updateEntry({ identities: [...entry.identities.filter((identity) => identity.provider !== provider || !visibleIds.has(identity.id)), ...Array.from(event.target.selectedOptions).map((option) => ({ provider, id: option.value }))] })
                    }}>{options.filter((account) => entry.identities.some((identity) => identity.provider === provider && identity.id === account.id) || `${account.name} ${account.email}`.toLocaleLowerCase('pt-BR').includes(accountSearch.toLocaleLowerCase('pt-BR'))).map((account) => {
                      const linkedElsewhere = entries.some((person) => person.id !== entry.id && person.identities.some((identity) => identity.provider === provider && identity.id === account.id))
                      return <option key={account.id} value={account.id} disabled={linkedElsewhere}>{account.name}{account.email ? ` · ${account.email}` : ''}{linkedElsewhere ? ' (já vinculada)' : ''}</option>
                    })}</select>
                  </label>
                })}
                <small id="account-help">Use Ctrl ou ⌘ para selecionar mais de uma conta. Contas já vinculadas a outra pessoa ficam indisponíveis.</small>
              </fieldset>
              {lastAdministrator(entry) && <p className={styles.warning}>Esta pessoa é a última administradora do painel. Vincule outro administrador antes de remover esse acesso.</p>}
              <div className={styles.actions}><button type="submit" disabled={!dirty || !entry.identities.length}>{busy ? 'Salvando…' : 'Salvar acessos'}</button>
                <button type="button" className={styles.secondary} onClick={() => selectEntry(blankEntry())}>Cancelar</button></div>
              {entry.id && <button type="button" className={styles.danger} disabled={lastAdministrator(entry)} onClick={() => {
                if (window.confirm(`Remover os papéis compartilhados de ${entry.name || 'esta pessoa'}? Suas contas e os conteúdos serão preservados.`))
                  void mutate({ action: 'delete', id: entry.id }, 'Vínculos e papéis compartilhados removidos. As contas foram preservadas.')
              }}>Remover acesso compartilhado</button>}
            </fieldset>
          </form>
        </section>
      </div>
    </>}
  </main>
}
