import type { Rules, User } from '../domain/types.ts'
import { fail } from '../domain/validation.ts'

export type WalletView = {
  /** Passive-income coins (the HUD fills this toward `cap`). */
  balance: number
  /** Reward coins from reading and quizzes. Earned without limit; spent after `balance`. */
  rewardBalance: number
  /** Everything the player can spend now: `balance + rewardBalance`. */
  spendable: number
  /** Passive-income cap. The HUD fills toward this number. */
  cap: number
  /** Absolute balance maximum. */
  absoluteCap: number
  nextCoinAt: number | null
  intervalMs: number
}

export class WalletService {
  private rules: Readonly<Rules>
  private now: () => number
  constructor(rules: Readonly<Rules>, now: () => number) {
    this.rules = rules
    this.now = now
  }
  unlimited(user: User) {
    return this.rules.infiniteCoins || (user.roles ?? []).includes('admin')
  }
  private passiveCap() {
    return this.rules.pipeline.passiveCap
  }
  private absoluteCap() {
    return this.rules.pipeline.walletCap
  }
  private intervalMs() {
    const rate = this.rules.pipeline.coinsPerMinute
    if (!Number.isSafeInteger(rate) || rate < 1) return 60_000
    return Math.max(1, Math.round(60_000 / rate))
  }
  read(user: User): WalletView {
    const intervalMs = this.intervalMs()
    if (this.unlimited(user)) {
      return {
        balance: Number.MAX_SAFE_INTEGER,
        rewardBalance: 0,
        spendable: Number.MAX_SAFE_INTEGER,
        cap: Number.MAX_SAFE_INTEGER,
        absoluteCap: Number.MAX_SAFE_INTEGER,
        nextCoinAt: null,
        intervalMs,
      }
    }
    const passiveCap = this.passiveCap()
    const absoluteCap = this.absoluteCap()
    if (user.balance > absoluteCap) user.balance = absoluteCap
    user.rewardBalance = Math.min(user.rewardBalance ?? 0, absoluteCap - user.balance)
    if (user.balance >= passiveCap) {
      user.coinAt = this.now()
    } else {
      const elapsed = Math.max(0, this.now() - user.coinAt)
      const room = passiveCap - user.balance
      const earned = Math.min(room, Math.floor(elapsed / intervalMs))
      if (earned > 0) {
        user.balance += earned
        user.coinAt =
          user.balance >= passiveCap
            ? this.now()
            : user.coinAt + earned * intervalMs
      }
    }
    return {
      balance: user.balance,
      rewardBalance: user.rewardBalance,
      spendable: user.balance + user.rewardBalance,
      cap: passiveCap,
      absoluteCap,
      nextCoinAt:
        user.balance >= passiveCap ? null : user.coinAt + intervalMs,
      intervalMs,
    }
  }
  /** Accrue passive coins, then deduct. Admins and infinite wallets skip the debit. */
  spend(user: User, amount: number) {
    if (!Number.isInteger(amount) || amount < 0) fail(400, 'Custo inválido.')
    if (amount === 0) return this.read(user)
    if (this.unlimited(user)) return this.read(user)
    const view = this.read(user)
    if (view.spendable < amount) fail(402, 'Moedas insuficientes.')
    // Passive coins go first: they regenerate, so draining them frees room for income.
    const fromPassive = Math.min(user.balance, amount)
    user.balance -= fromPassive
    user.rewardBalance = (user.rewardBalance ?? 0) - (amount - fromPassive)
    return this.read(user)
  }
  /**
   * Add coins that are not time income (a refund).
   * The sum may pass the passive cap and stops at the absolute cap.
   * Passive income stays off while the balance is at or above the passive cap.
   */
  credit(user: User, amount: number) {
    if (!Number.isInteger(amount) || amount < 0) fail(400, 'Custo inválido.')
    if (amount === 0 || this.unlimited(user)) return this.read(user)
    this.read(user)
    const absoluteCap = this.absoluteCap()
    const room = absoluteCap - user.balance - (user.rewardBalance ?? 0)
    user.balance += Math.max(0, Math.min(room, amount))
    return this.read(user)
  }
  /**
   * Add reward coins (reading, quizzes). They never count toward the passive cap,
   * so earning them is unbounded except for the absolute wallet cap.
   */
  reward(user: User, amount: number) {
    if (!Number.isInteger(amount) || amount < 0) fail(400, 'Valor inválido.')
    if (amount === 0 || this.unlimited(user)) return this.read(user)
    this.read(user)
    const room = this.absoluteCap() - user.balance - (user.rewardBalance ?? 0)
    user.rewardBalance = (user.rewardBalance ?? 0) + Math.max(0, Math.min(room, amount))
    return this.read(user)
  }
}
