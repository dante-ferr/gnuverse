import Link from 'next/link'
import styles from './home.module.css'

function CollaborationDiagram() {
  return (
    <div className={styles.diagram} aria-hidden="true">
      <svg viewBox="0 0 620 480" role="presentation">
        <path className={styles.grid} d="M30 40H590M30 120H590M30 200H590M30 280H590M30 360H590M30 440H590M70 20V460M150 20V460M230 20V460M310 20V460M390 20V460M470 20V460M550 20V460" />
        <path className={styles.connections} d="M110 130 260 210 410 110 510 210M260 210 190 350 410 350 510 210M110 130 190 350M410 110 410 350" />
        <path className={styles.tower} d="M250 348h120l-12-48h-96l-12 48Zm15-48 10-48h70l13 48Zm20-48 8-48h37l13 48Zm18-48 4-45h24l5 45Z" />
        <path className={styles.towerDetail} d="M250 348h120M265 300h96M275 252h70M283 204h50M303 159h24" />
        <circle className={styles.nodeAccent} cx="110" cy="130" r="8" />
        <circle className={styles.nodeAccent} cx="410" cy="110" r="8" />
        <circle className={styles.nodeCoral} cx="510" cy="210" r="8" />
        <circle className={styles.nodeCoral} cx="190" cy="350" r="8" />
        <circle className={styles.nodeCore} cx="310" cy="204" r="5" />
      </svg>
      <span className={`${styles.coord} ${styles.coordTop}`}>N 01 / 07</span>
      <span className={`${styles.coord} ${styles.coordBottom}`}>ESTRUTURA EM COMUM</span>
    </div>
  )
}

export default function Home() {
  return (
    <main className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.copy}>
          <p className={styles.kicker}>
            <span className={styles.liveDot} />
            GNUVERSE <span className={styles.separator}>/</span> SOFTWARE LIVRE
          </p>
          <h1 id="home-title">
            Tecnologia
            <br />
            como <span>bem comum.</span>
          </h1>
          <p className={styles.lede}>
            Investigar como o software livre amplia o acesso à tecnologia —
            com ideias, experiências e construção coletiva.
          </p>
          <nav className={styles.actions} aria-label="Explorar o projeto">
            <Link className={styles.primaryLink} href="/jogo/">
              <span>Entrar na torre</span>
              <span aria-hidden="true">↗</span>
            </Link>
            <Link className={styles.secondaryLink} href="/blog/">
              Ler o blog <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
        <CollaborationDiagram />
      </section>

      <footer className={styles.footer} id="ponto-de-partida">
        <p>Pesquisa, autoria e colaboração por 7 participantes.</p>
        <p className={styles.course}>MATA68 <span>·</span> 2026.2</p>
      </footer>
    </main>
  )
}
