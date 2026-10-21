import Link from 'next/link'

export const metadata = {
  title: 'Jogo — GNUverse',
  description: 'Um espaço para construir, colaborar e decidir em conjunto.',
}

export default function GamePage() {
  return (
    <main className="intro mx-auto grid min-h-[calc(100svh-7rem)] max-w-7xl items-center gap-12 px-6 py-16 sm:px-12 lg:grid-cols-2 lg:px-20">
      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-violet-800">Torres colaborativas · em construção</p>
        <h1 className="mt-6 max-w-xl text-5xl leading-[1.05] tracking-tight sm:text-7xl">
          Uma torre.<br /><span className="font-serif italic text-violet-700">Muitas mãos.</span>
        </h1>
        <p className="mt-8 max-w-md text-lg leading-relaxed text-stone-600">
          Construir, transformar e decidir em conjunto. Estamos preparando uma experiência sobre o que acontece quando uma construção pertence a uma comunidade.
        </p>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-stone-500">O jogo ainda não está disponível. Em breve, este espaço ganha seus primeiros blocos.</p>
        <Link href="/" className="mt-8 inline-block text-sm text-violet-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700">← Voltar ao início</Link>
      </section>
      <div aria-hidden="true" className="network mx-auto flex aspect-square w-full max-w-sm items-end justify-center border-b-2 border-stone-300 pb-3">
        <div className="flex w-3/4 flex-col gap-2">
          <div className="ml-auto h-16 w-1/2 rotate-6 rounded-xl border border-violet-400 bg-violet-200" />
          <div className="flex gap-2"><div className="h-20 flex-1 rounded-xl border border-violet-300 bg-violet-100" /><div className="h-20 flex-1 rounded-xl border border-stone-300 bg-stone-200" /></div>
          <div className="h-16 w-full rounded-xl border border-violet-500 bg-violet-300" />
          <div className="flex gap-2"><div className="h-20 flex-[2] rounded-xl border border-stone-400 bg-stone-200" /><div className="h-20 flex-1 rounded-xl border border-violet-300 bg-violet-100" /></div>
        </div>
      </div>
    </main>
  )
}
