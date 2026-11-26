import Link from 'next/link'
import { StarChart } from '@/components/home/star-chart'
import styles from './home.module.css'

const pillars = [
  {
    number: '01',
    title: 'Open Pipeline',
    description:
      'Jogo cooperativo em que a turma monta esteiras e máquinas para abastecer núcleos compartilhados.',
    href: '/jogo/',
    cta: 'Entrar no jogo',
  },
  {
    number: '02',
    title: 'Blog Autoral',
    description:
      'Textos escritos pelos participantes sobre software livre, acesso à tecnologia e autoria coletiva.',
    href: '/blog/',
    cta: 'Ler o blog',
  },
  {
    number: '03',
    title: 'Quizzes',
    description: 'Perguntas rápidas para testar e fixar o que aprendemos sobre software livre.',
    href: '/quizzes/',
    cta: 'Responder quizzes',
  },
]

export default function Home() {
  return (
    <main className={styles.home}>
      <StarChart>
        <h1 id="home-title" className={styles.title}>
          Tecnologia
          <br />
          como bem comum.
        </h1>
        <p className={styles.lede}>
          Investigar como o software livre amplia o acesso à tecnologia — com ideias,
          experiências e construção coletiva.
        </p>
        <nav className={styles.actions} aria-label="Explorar o projeto">
          <Link className={styles.primaryLink} href="/jogo/">
            <span>Entrar no jogo</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link className={styles.secondaryLink} href="/blog/">
            <span>Ler o blog</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </StarChart>

      <div className={styles.inner}>
        <section className={styles.pillars} aria-labelledby="pillars-title">
          <h2 id="pillars-title" className={styles.visuallyHidden}>
            Pilares do GNUverse
          </h2>
          <ul className={styles.pillarList}>
            {pillars.map((pillar) => (
              <li key={pillar.href} className={styles.pillar}>
                <h3 className={styles.pillarTitle}>
                  <span className={styles.pillarNumber}>{pillar.number} /</span> {pillar.title}
                </h3>
                <p className={styles.pillarText}>{pillar.description}</p>
                <Link className={styles.pillarLink} href={pillar.href}>
                  {pillar.cta} <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className={styles.footer} id="ponto-de-partida">
          <p>Pesquisa, autoria e colaboração por 7 participantes.</p>
          <p className={styles.course}>
            MATA68 <span>·</span> 2026.2
          </p>
        </footer>
      </div>
    </main>
  )
}
