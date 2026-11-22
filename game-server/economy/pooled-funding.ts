export type PooledBacker = { userId: string; amount: number }

/** One keyed coin pool toward a fixed purchase price. */
export type PooledPledge = {
  key: string
  paid: number
  backers: PooledBacker[]
}

export type PooledQuote =
  | { ok: true; cost: number; paid: number; remaining: number }
  | { ok: false; status: 400 | 409; error: string }

export function quotePledge(input: {
  paid: number
  cost: number
  amount: number
  eligible: boolean
}): PooledQuote {
  if (!input.eligible) {
    return { ok: false, status: 409, error: 'Este alvo não aceita aportes agora.' }
  }
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    return { ok: false, status: 400, error: 'Informe quantas moedas aportar.' }
  }
  const remaining = input.cost - input.paid
  if (remaining <= 0) {
    return { ok: false, status: 409, error: 'Este alvo já está pago.' }
  }
  if (input.amount > remaining) {
    return {
      ok: false,
      status: 400,
      error: `Faltam ${remaining} moedas para concluir.`,
    }
  }
  return {
    ok: true,
    cost: input.cost,
    paid: input.paid,
    remaining,
  }
}

/** Add coins to the pool for `key`. Caller removes the pledge and grants on `completed`. */
export function applyPledge(
  pledges: PooledPledge[],
  key: string,
  userId: string,
  amount: number,
  cost: number,
  create?: (key: string) => PooledPledge,
): { paid: number; completed: boolean } {
  let pledge = pledges.find((item) => item.key === key)
  if (!pledge) {
    pledge = create?.(key) ?? { key, paid: 0, backers: [] }
    pledges.push(pledge)
  }
  pledge.paid += amount
  const backer = pledge.backers.find((item) => item.userId === userId)
  if (backer) backer.amount += amount
  else pledge.backers.push({ userId, amount })
  if (pledge.paid < cost) return { paid: pledge.paid, completed: false }
  const paid = pledge.paid
  const index = pledges.findIndex((item) => item.key === key)
  if (index >= 0) pledges.splice(index, 1)
  return { paid, completed: true }
}