import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  validateQuiz,
  scoreQuiz,
  normalizeQuizTitle,
  quizSlug,
} from '../core/quiz/quiz.ts'

const quiz = {
  title: 'Liberdades',
  summary: 'Teste seus conhecimentos.',
  questions: [
    {
      prompt: 'Qual liberdade?',
      choices: [{ text: 'Estudar' }, { text: 'Restringir' }],
      correctAnswer: 0,
      explanation: 'Podemos estudar o código.',
    },
  ],
}
test('validates independent quizzes and refuses broken or ambiguous questions', () => {
  assert.equal(validateQuiz(quiz), null)
  assert.match(validateQuiz({ ...quiz, questions: [] })!, /1 a 30/)
  for (const correctAnswer of [-1, 2, 0.5, '0', null]) {
    assert.match(
      validateQuiz({
        ...quiz,
        questions: [{ ...quiz.questions[0], correctAnswer }],
      })!,
      /correta/,
    )
  }
  assert.match(
    validateQuiz({
      ...quiz,
      questions: [{ ...quiz.questions[0], explanation: ' ' }],
    })!,
    /explique/,
  )
  assert.match(
    validateQuiz({
      ...quiz,
      questions: [
        {
          ...quiz.questions[0],
          choices: [{ text: 'Estudar' }, { text: ' estudar ' }],
        },
      ],
    })!,
    /diferentes/,
  )
})
test('scores complete attempts and rejects missing or out of range answers', () => {
  assert.equal(scoreQuiz(quiz.questions, [0]), 1)
  assert.equal(scoreQuiz(quiz.questions, [1]), 0)
  for (const answers of [[], [2], [-1], [0.5], [0, 1]]) {
    assert.throws(() => scoreQuiz(quiz.questions, answers), /todas/)
  }
})

test('generates quiz addresses from names and normalizes name comparisons', () => {
  assert.equal(normalizeQuizTitle('  Meu   Quiz  '), 'Meu Quiz')
  assert.equal(
    quizSlug('Você conhece software livre?'),
    'voce-conhece-software-livre',
  )
  assert.equal(quizSlug('Criar'), 'quiz-criar')
  assert.match(validateQuiz({ ...quiz, title: '!!!' })!, /título/)
})
