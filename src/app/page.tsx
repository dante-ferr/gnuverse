export default function Home() {
  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-hidden px-6 py-8 sm:px-12 lg:px-20">
      <div aria-hidden="true" className="paper-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />
      <header className="flex items-center justify-between gap-4 border-b border-stone-300 pb-6">
        <span className="text-xl font-bold tracking-tight">gnuverse<span className="text-violet-700">↗</span></span>
        <span className="text-xs tracking-widest text-stone-600">MATA68 · 2026.2</span>
      </header>
      <section className="intro grid flex-1 items-center gap-14 py-20 lg:grid-cols-[1.3fr_1fr] lg:py-28">
        <div>
          <p className="mb-6 text-xs uppercase tracking-[0.18em] text-violet-800">Software livre · possibilidades compartilhadas</p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-medium tracking-tight sm:text-7xl xl:text-8xl">
            Tecnologia para <span className="font-serif italic text-violet-700">mais gente.</span>
          </h1>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-stone-600">
            Como o software livre pode democratizar o acesso à tecnologia?
            Uma pergunta para investigar, experimentar e discutir juntos.
          </p>
          <a href="#ponto-de-partida" className="mt-10 inline-flex items-center gap-8 rounded-full bg-violet-700 px-6 py-4 text-sm text-white transition duration-300 hover:-translate-y-1 hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700">
            Nosso ponto de partida <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div aria-hidden="true" className="network relative mx-auto aspect-square w-full max-w-sm">
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full fill-none stroke-violet-400" strokeWidth="1.5">
            <circle cx="200" cy="200" r="145" strokeDasharray="3 8" />
            <path d="M200 200 85 95 M200 200 320 110 M200 200 300 315 M200 200 70 290" />
          </svg>
          <div className="absolute inset-[30%] flex flex-col items-center justify-center rounded-full border border-violet-300 bg-violet-100 text-center">
            <span className="text-4xl text-violet-700">✳</span>
            <span className="mt-2 text-xs font-semibold tracking-widest text-violet-900">EM COMUM</span>
          </div>
          <span className="network-node absolute left-[3%] top-[16%] -rotate-6">aprender</span>
          <span className="network-node absolute right-0 top-[20%] rotate-6">criar</span>
          <span className="network-node absolute bottom-[14%] right-0 -rotate-3">compartilhar</span>
          <span className="network-node absolute bottom-[20%] left-0 rotate-3">participar</span>
        </div>
      </section>
      <footer id="ponto-de-partida" className="flex scroll-mt-8 flex-col justify-between gap-3 border-t border-stone-300 pt-6 text-sm text-stone-600 sm:flex-row">
        <p>Em construção por 7 pessoas. Pesquisa, autoria e colaboração.</p>
        <p className="text-xs uppercase tracking-widest">Uma pergunta aberta. Um universo em comum.</p>
      </footer>
    </main>
  );
}
