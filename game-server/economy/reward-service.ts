import type { Rules, User } from '../domain/types.ts'
import { fail } from '../domain/validation.ts'
import { questionKey, validSlug, type ContentCatalog } from './content-catalog.ts'
import type { WalletService } from './wallet-service.ts'

const PENDING_LIMIT = 5000

export type GradedQuiz = { slug: string; questions: { key: string; correct: boolean }[] }

/**
 * Coins for learning: reading an article and answering quiz questions correctly.
 * Each reward is paid once per account per item, into the separate reward wallet.
 * Amounts live in pipeline.toml.
 */
export class RewardService {
  private rules: Readonly<Rules>
  private now: () => number
  private wallet: WalletService
  private catalog: ContentCatalog
  /** Article opens awaiting a claim. Memory only: a restart just restarts the reading timer. */
  private opened = new Map<string, number>()
  constructor(rules: Readonly<Rules>, now: () => number, wallet: WalletService, catalog: ContentCatalog) {
    this.rules = rules
    this.now = now
    this.wallet = wallet
    this.catalog = catalog
  }
  private claims(user: User) {
    return (user.rewardClaims ??= {})
  }
  /** Registers that the player opened an article and starts the reading timer. */
  async openArticle(user: User, slug: unknown) {
    if (!validSlug(slug)) fail(400, 'Artigo inválido.')
    const key = `article:${slug}`
    const pipeline = this.rules.pipeline
    const view = { coins: pipeline.rewardArticleReadCoins, minSeconds: pipeline.rewardArticleMinReadSeconds }
    if (this.claims(user)[key]) return { ...view, claimed: true }
    if (!(await this.catalog.hasArticle(slug))) fail(404, 'Artigo não encontrado.')
    if (this.opened.size >= PENDING_LIMIT) this.opened.clear()
    const id = `${user.id}\n${slug}`
    if (!this.opened.has(id)) this.opened.set(id, this.now())
    return { ...view, claimed: false }
  }
  /** Pays the reading reward once, after the minimum reading time. */
  claimArticle(user: User, slug: unknown) {
    if (!validSlug(slug)) fail(400, 'Artigo inválido.')
    const key = `article:${slug}`
    const claims = this.claims(user)
    if (claims[key]) return { awarded: 0, claimed: true, wallet: this.wallet.read(user) }
    const startedAt = this.opened.get(`${user.id}\n${slug}`)
    if (startedAt === undefined) fail(409, 'Abra o artigo antes de resgatar a recompensa.')
    const minMs = this.rules.pipeline.rewardArticleMinReadSeconds * 1000
    if (this.now() - startedAt < minMs)
      fail(425, 'Continue lendo: o artigo foi aberto há pouco tempo.')
    const amount = this.rules.pipeline.rewardArticleReadCoins
    claims[key] = this.now()
    this.opened.delete(`${user.id}\n${slug}`)
    return { awarded: amount, claimed: true, wallet: this.wallet.reward(user, amount) }
  }
  /** Grades a complete attempt against the published quiz. Fetches content, so it runs outside the store transaction. */
  async gradeQuiz(_user: User, slug: unknown, answers: unknown): Promise<GradedQuiz> {
    if (!validSlug(slug)) fail(400, 'Quiz inválido.')
    const quiz = await this.catalog.quiz(slug)
    if (!quiz) fail(404, 'Quiz não encontrado.')
    if (
      !Array.isArray(answers) ||
      answers.length !== quiz.questions.length ||
      !answers.every((answer, index) =>
        Number.isInteger(answer) && answer >= 0 && answer < quiz.questions[index]!.choiceCount)
    )
      fail(400, 'Responda todas as perguntas antes de resgatar.')
    return {
      slug,
      questions: quiz.questions.map((question, index) => ({
        key: questionKey(question.prompt),
        correct: question.correctAnswer === answers[index],
      })),
    }
  }
  /** Pays each newly correct question and the first perfect score. Runs inside the store transaction. */
  payQuiz(user: User, graded: GradedQuiz) {
    const pipeline = this.rules.pipeline
    const claims = this.claims(user)
    let awarded = 0
    let newlyCorrect = 0
    for (const question of graded.questions) {
      const key = `quiz:${graded.slug}:${question.key}`
      if (!question.correct || claims[key]) continue
      claims[key] = this.now()
      newlyCorrect++
      awarded += pipeline.rewardQuizCorrectCoins
    }
    const perfectKey = `quiz:${graded.slug}:perfect`
    let bonus = 0
    if (graded.questions.every((question) => question.correct) && !claims[perfectKey]) {
      claims[perfectKey] = this.now()
      bonus = pipeline.rewardQuizPerfectBonusCoins
      awarded += bonus
    }
    return {
      correct: graded.questions.filter((question) => question.correct).length,
      total: graded.questions.length,
      newlyCorrect,
      bonus,
      awarded,
      wallet: awarded > 0 ? this.wallet.reward(user, awarded) : this.wallet.read(user),
    }
  }
}
