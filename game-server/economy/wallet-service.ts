import type { Rules, User } from '../domain/types.ts'
export class WalletService {
  private rules: Readonly<Rules>
  private now: () => number
  constructor(rules: Readonly<Rules>, now: () => number) {
    this.rules = rules
    this.now = now
  }
  read(user: User) {
    user.balance = Math.min(user.balance, this.rules.cap)
    const elapsed = Math.max(0, this.now() - user.coinAt)
    const earned = Math.floor(elapsed / this.rules.intervalMs)
    if (user.balance >= this.rules.cap) user.coinAt = this.now()
    else if (earned) {
      user.balance = Math.min(this.rules.cap, user.balance + earned)
      user.coinAt =
        user.balance === this.rules.cap
          ? this.now()
          : user.coinAt + earned * this.rules.intervalMs
    }
    return {
      balance: user.balance,
      cap: this.rules.cap,
      nextCoinAt:
        user.balance >= this.rules.cap
          ? null
          : user.coinAt + this.rules.intervalMs,
      intervalMs: this.rules.intervalMs,
    }
  }
}
