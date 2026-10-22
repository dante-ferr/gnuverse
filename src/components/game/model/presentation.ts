export const formatGameDate = (value: number) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
export const governanceLabel = (mode: string) =>
  mode === 'vote' ? 'Votação' : 'BDFL'
export const eventLabels: Record<string, string> = {
  created: 'Torre criada',
  snapshot: 'Versão registrada',
  'block-placed': 'Bloco lançado',
  restore: 'Versão restaurada',
  ban: 'Suspensão aplicada',
  'ban-expired': 'Suspensão encerrada',
  proposal: 'Proposta aberta',
  vote: 'Voto registrado',
  'vote-result': 'Votação concluída',
  'bdfl-decision': 'Decisão do BDFL',
  eligibility: 'Habilitação alterada',
  settings: 'Regras alteradas',
  'wind-scheduled': 'Ventania agendada',
  'wind-start': 'Ventania iniciada',
  'wind-end': 'Ventania encerrada',
  'wind-settled': 'Torre estabilizada',
  'restore-deferred': 'Restauração adiada',
}
export const statusLabels: Record<string, string> = {
  pending: 'Em discussão',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
}
