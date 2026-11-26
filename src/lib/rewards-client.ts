import type { GameApi } from '@/components/game/api/game-api'
import type { Wallet } from '@/components/game/model/types'

export type ArticleOpenResult = { coins: number; minSeconds: number; claimed: boolean }
export type ArticleClaimResult = { awarded: number; claimed: boolean; wallet: Wallet }
export type QuizClaimResult = {
  correct: number
  total: number
  newlyCorrect: number
  bonus: number
  awarded: number
  wallet: Wallet
}

/** Reward endpoints of the game server. Amounts and verification are server-side only. */
export const rewardsApi = {
  openArticle: (api: GameApi, slug: string) =>
    api.request<ArticleOpenResult>('/api/rewards/article/open', { slug }),
  claimArticle: (api: GameApi, slug: string) =>
    api.request<ArticleClaimResult>('/api/rewards/article/claim', { slug }),
  claimQuiz: (api: GameApi, slug: string, answers: number[]) =>
    api.request<QuizClaimResult>('/api/rewards/quiz/claim', { slug, answers }),
}
