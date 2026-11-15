export const formatGameDate = (value: number) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
export const statusLabels: Record<string, string> = {
  pending: 'Em discussão',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
}