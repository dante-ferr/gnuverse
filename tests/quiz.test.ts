import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateQuiz, scoreQuiz } from '../core/quiz/quiz.ts'

const quiz = {
  title: 'Liberdades',
  slug: 'liberdades',
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
  assert.match(validateQuiz({ ...quiz, slug: 'criar' })!, /reservado/)
  assert.match(validateQuiz({ ...quiz, questions: [] })!, /1 a 30/)
  assert.match(validateQuiz({ ...quiz, slug: '../invalido' })!, /endereço/)
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
