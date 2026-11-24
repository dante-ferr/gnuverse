import { QuizEditor } from '@/components/quiz/quiz-editor'

export const metadata = { title: 'Criar quiz — GNUverse' }
export default function CreateQuizPage() {
  return (
    <main className="[overflow-wrap:anywhere] mx-auto min-h-svh max-w-4xl px-6 py-10 sm:px-12">
      <QuizEditor />
    </main>
  )
}
