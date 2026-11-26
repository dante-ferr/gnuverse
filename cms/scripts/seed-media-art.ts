/**
 * Deterministic 16:9 (1200x675) SVG editorial illustrations and diagrams for
 * the local CMS demo seed. Converted to PNG via sharp during seeding so
 * `make cms-reset` works completely offline with zero broken links.
 */

export type SeedMediaSpec = {
  key: string
  filename: string
  alt: string
  credit: string
  svg: string
}

const BG = '#121315'
const SURFACE = '#181a1d'
const RAISED = '#202327'
const LINE = '#2a2e33'
const MUTED = '#a3a8ae'
const INK = '#edf4f4'
const ACCENT = '#52d6c9'
const CORAL = '#ff8b7d'

function frame(content: string, subtitle: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="${BG}"/>
  <g stroke="${LINE}" stroke-width="1" opacity="0.55">
    <line x1="0" y1="135" x2="1200" y2="135"/>
    <line x1="0" y1="270" x2="1200" y2="270"/>
    <line x1="0" y1="405" x2="1200" y2="405"/>
    <line x1="0" y1="540" x2="1200" y2="540"/>
    <line x1="200" y1="0" x2="200" y2="675"/>
    <line x1="400" y1="0" x2="400" y2="675"/>
    <line x1="600" y1="0" x2="600" y2="675"/>
    <line x1="800" y1="0" x2="800" y2="675"/>
    <line x1="1000" y1="0" x2="1000" y2="675"/>
  </g>
  ${content}
  <text x="64" y="622" fill="${MUTED}" font-family="monospace" font-size="18" letter-spacing="1">${subtitle}</text>
  <circle cx="1136" cy="616" r="6" fill="${ACCENT}"/>
</svg>`
}

export const SEED_MEDIA_SPECS: SeedMediaSpec[] = [
  {
    key: 'cover-ola-gnuverse',
    filename: 'capa-ola-gnuverse.png',
    alt: 'Carta celeste minimalista com constelação conectando nós de colaboração do coletivo GNUverse',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <circle cx="600" cy="320" r="230" fill="none" stroke="${LINE}" stroke-width="1.5"/>
      <circle cx="600" cy="320" r="150" fill="none" stroke="${ACCENT}" stroke-width="1.5" opacity="0.45"/>
      <circle cx="600" cy="320" r="76" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
      <g stroke="${ACCENT}" stroke-width="1.5" opacity="0.7">
        <line x1="370" y1="240" x2="524" y2="320"/>
        <line x1="676" y1="320" x2="830" y2="215"/>
        <line x1="600" y1="396" x2="770" y2="475"/>
        <line x1="524" y1="320" x2="420" y2="460"/>
      </g>
      <circle cx="600" cy="320" r="12" fill="${ACCENT}"/>
      <circle cx="370" cy="240" r="8" fill="${INK}"/>
      <circle cx="830" cy="215" r="8" fill="${ACCENT}"/>
      <circle cx="770" cy="475" r="8" fill="${CORAL}"/>
      <circle cx="420" cy="460" r="8" fill="${INK}"/>
      <text x="392" y="236" fill="${MUTED}" font-family="monospace" font-size="16">GNU</text>
      <text x="848" y="220" fill="${ACCENT}" font-family="monospace" font-size="16">GPLv3</text>
      <text x="788" y="480" fill="${CORAL}" font-family="monospace" font-size="16">LINUX</text>
      <text x="348" y="466" fill="${MUTED}" font-family="monospace" font-size="16">GIT</text>
      `,
      'GNUVERSE · SOFTWARE LIVRE COMO BEM COMUM',
    ),
  },
  {
    key: 'cover-autonomia-digital',
    filename: 'capa-autonomia-digital.png',
    alt: 'Diagrama geométrico de quatro camadas abertas simbolizando as liberdades do software livre',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <g transform="translate(260, 125)">
        <rect x="0" y="0" width="680" height="82" rx="8" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
        <rect x="0" y="106" width="680" height="82" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="1.5"/>
        <rect x="0" y="212" width="680" height="82" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="1.5"/>
        <rect x="0" y="318" width="680" height="82" rx="8" fill="${RAISED}" stroke="${CORAL}" stroke-width="1.5"/>
        <text x="32" y="48" fill="${ACCENT}" font-family="monospace" font-size="22">00 · EXECUTAR PARA QUALQUER PROPÓSITO</text>
        <text x="32" y="154" fill="${INK}" font-family="monospace" font-size="22">01 · ESTUDAR E ADAPTAR O CÓDIGO-FONTE</text>
        <text x="32" y="260" fill="${INK}" font-family="monospace" font-size="22">02 · REDISTRIBUIR CÓPIAS À COMUNIDADE</text>
        <text x="32" y="366" fill="${CORAL}" font-family="monospace" font-size="22">03 · COMPARTILHAR MELHORIAS LIVREMENTE</text>
      </g>
      `,
      'AUTONOMIA DIGITAL · AS QUATRO LIBERDADES',
    ),
  },
  {
    key: 'cover-oficinas-escola',
    filename: 'capa-oficinas-escola.png',
    alt: 'Ilustração de terminal GNU/Linux e bancada de computadores escolares recuperados com sistemas livres',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <rect x="190" y="120" width="820" height="410" rx="10" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
      <rect x="190" y="120" width="820" height="46" rx="10" fill="${RAISED}"/>
      <line x1="190" y1="166" x2="1010" y2="166" stroke="${LINE}" stroke-width="1.5"/>
      <circle cx="222" cy="143" r="6" fill="${CORAL}"/>
      <circle cx="244" cy="143" r="6" fill="${MUTED}"/>
      <circle cx="266" cy="143" r="6" fill="${ACCENT}"/>
      <text x="300" y="149" fill="${MUTED}" font-family="monospace" font-size="16">laboratorio@escola-publica:~/oficina</text>
      <text x="230" y="222" fill="${ACCENT}" font-family="monospace" font-size="22">$ uname -srm</text>
      <text x="230" y="260" fill="${INK}" font-family="monospace" font-size="20">Linux 6.12 GNU/Linux · Debian + XFCE</text>
      <text x="230" y="320" fill="${ACCENT}" font-family="monospace" font-size="22">$ apt install libreoffice gimp python3 git</text>
      <text x="230" y="358" fill="${MUTED}" font-family="monospace" font-size="20">18 estações recuperadas · 100% software livre</text>
      <rect x="230" y="408" width="520" height="16" rx="4" fill="${RAISED}"/>
      <rect x="230" y="408" width="430" height="16" rx="4" fill="${ACCENT}"/>
      <text x="230" y="468" fill="${MUTED}" font-family="monospace" font-size="18">MEMÓRIA EM USO: 412 MB / 4096 MB</text>
      `,
      'EDUCAÇÃO PÚBLICA · OFICINAS DE CÓDIGO ABERTO',
    ),
  },
  {
    key: 'cover-redes-comunitarias',
    filename: 'capa-redes-comunitarias.png',
    alt: 'Mapa de rede em malha comunitária ligando antenas locais e biblioteca digital offline',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <g stroke="${ACCENT}" stroke-width="2" opacity="0.65">
        <line x1="250" y1="320" x2="470" y2="190"/>
        <line x1="250" y1="320" x2="470" y2="450"/>
        <line x1="470" y1="190" x2="730" y2="190"/>
        <line x1="470" y1="450" x2="730" y2="450"/>
        <line x1="470" y1="190" x2="600" y2="320"/>
        <line x1="470" y1="450" x2="600" y2="320"/>
        <line x1="730" y1="190" x2="600" y2="320"/>
        <line x1="730" y1="450" x2="600" y2="320"/>
        <line x1="730" y1="190" x2="950" y2="320"/>
        <line x1="730" y1="450" x2="950" y2="320"/>
      </g>
      <circle cx="600" cy="320" r="46" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2.5"/>
      <circle cx="600" cy="320" r="14" fill="${ACCENT}"/>
      <circle cx="250" cy="320" r="22" fill="${SURFACE}" stroke="${INK}" stroke-width="2"/>
      <circle cx="470" cy="190" r="22" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
      <circle cx="470" cy="450" r="22" fill="${SURFACE}" stroke="${CORAL}" stroke-width="2"/>
      <circle cx="730" cy="190" r="22" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
      <circle cx="730" cy="450" r="22" fill="${SURFACE}" stroke="${INK}" stroke-width="2"/>
      <circle cx="950" cy="320" r="22" fill="${SURFACE}" stroke="${CORAL}" stroke-width="2"/>
      <text x="530" y="398" fill="${INK}" font-family="monospace" font-size="16">NÓ CENTRAL MESH</text>
      <text x="190" y="366" fill="${MUTED}" font-family="monospace" font-size="15">ASSOCIAÇÃO</text>
      <text x="900" y="366" fill="${MUTED}" font-family="monospace" font-size="15">BIBLIOTECA</text>
      `,
      'INFRAESTRUTURA COMUM · REDES COMUNITÁRIAS',
    ),
  },
  {
    key: 'cover-festival-instalacao',
    filename: 'capa-festival-instalacao.png',
    alt: 'Esquema de partições e mídia de instalação livre representando um InstallFest universitário',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <rect x="180" y="185" width="840" height="270" rx="10" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
      <rect x="220" y="235" width="160" height="120" rx="6" fill="${RAISED}" stroke="${ACCENT}" stroke-width="2"/>
      <rect x="400" y="235" width="260" height="120" rx="6" fill="${RAISED}" stroke="${LINE}" stroke-width="1.5"/>
      <rect x="680" y="235" width="300" height="120" rx="6" fill="${RAISED}" stroke="${CORAL}" stroke-width="1.5"/>
      <text x="242" y="286" fill="${ACCENT}" font-family="monospace" font-size="22">/boot</text>
      <text x="242" y="320" fill="${MUTED}" font-family="monospace" font-size="16">EFI · 512 MB</text>
      <text x="424" y="286" fill="${INK}" font-family="monospace" font-size="22">/ (sistema)</text>
      <text x="424" y="320" fill="${MUTED}" font-family="monospace" font-size="16">ext4 · Debian</text>
      <text x="704" y="286" fill="${CORAL}" font-family="monospace" font-size="22">/home</text>
      <text x="704" y="320" fill="${MUTED}" font-family="monospace" font-size="16">arquivos &amp; backup</text>
      <text x="220" y="415" fill="${MUTED}" font-family="monospace" font-size="18">INSTALLFEST NO CAMPUS · +20 NOTEBOOKS RECUPERADOS</text>
      `,
      'MUTIRÃO NO CAMPUS · FESTIVAL DE INSTALAÇÃO LIVRE',
    ),
  },
  {
    key: 'cover-documentacao-aberta',
    filename: 'capa-documentacao-aberta.png',
    alt: 'Páginas versionadas e guias colaborativos ilustrando a importância da documentação livre',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <rect x="250" y="130" width="310" height="390" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
      <rect x="640" y="130" width="310" height="390" rx="8" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
      <line x1="560" y1="325" x2="640" y2="325" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 6"/>
      <rect x="290" y="180" width="160" height="14" rx="3" fill="${INK}"/>
      <rect x="290" y="218" width="230" height="10" rx="3" fill="${LINE}"/>
      <rect x="290" y="244" width="210" height="10" rx="3" fill="${LINE}"/>
      <rect x="290" y="270" width="225" height="10" rx="3" fill="${LINE}"/>
      <rect x="290" y="320" width="140" height="12" rx="3" fill="${MUTED}"/>
      <rect x="290" y="352" width="220" height="10" rx="3" fill="${LINE}"/>
      <rect x="290" y="378" width="190" height="10" rx="3" fill="${LINE}"/>
      <rect x="680" y="180" width="180" height="14" rx="3" fill="${ACCENT}"/>
      <rect x="680" y="218" width="230" height="10" rx="3" fill="${MUTED}" opacity="0.6"/>
      <rect x="680" y="244" width="205" height="10" rx="3" fill="${MUTED}" opacity="0.6"/>
      <rect x="680" y="270" width="220" height="10" rx="3" fill="${MUTED}" opacity="0.6"/>
      <rect x="680" y="320" width="150" height="12" rx="3" fill="${CORAL}"/>
      <rect x="680" y="352" width="225" height="10" rx="3" fill="${MUTED}" opacity="0.6"/>
      <rect x="680" y="378" width="195" height="10" rx="3" fill="${MUTED}" opacity="0.6"/>
      <text x="290" y="478" fill="${MUTED}" font-family="monospace" font-size="16">MANUAL.MD</text>
      <text x="680" y="478" fill="${ACCENT}" font-family="monospace" font-size="16">TRADUÇÃO PT-BR</text>
      `,
      'CULTURA LIVRE · DOCUMENTAÇÃO ABERTA E COLABORATIVA',
    ),
  },
  {
    key: 'cover-bibliotecas-offline',
    filename: 'capa-bibliotecas-offline.png',
    alt: 'Servidor local conectado a dispositivos de sala de aula distribuindo acervo educacional offline',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <rect x="210" y="180" width="240" height="290" rx="8" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
      <rect x="242" y="220" width="176" height="44" rx="4" fill="${RAISED}" stroke="${LINE}"/>
      <rect x="242" y="284" width="176" height="44" rx="4" fill="${RAISED}" stroke="${LINE}"/>
      <rect x="242" y="348" width="176" height="44" rx="4" fill="${RAISED}" stroke="${LINE}"/>
      <circle cx="394" cy="242" r="5" fill="${ACCENT}"/>
      <circle cx="394" cy="306" r="5" fill="${ACCENT}"/>
      <circle cx="394" cy="370" r="5" fill="${CORAL}"/>
      <text x="242" y="438" fill="${INK}" font-family="monospace" font-size="17">SERVIDOR LOCAL</text>
      <g stroke="${ACCENT}" stroke-width="2" opacity="0.75">
        <line x1="450" y1="250" x2="680" y2="190"/>
        <line x1="450" y1="325" x2="680" y2="325"/>
        <line x1="450" y1="400" x2="680" y2="460"/>
      </g>
      <rect x="680" y="145" width="300" height="86" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="1.5"/>
      <rect x="680" y="282" width="300" height="86" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="1.5"/>
      <rect x="680" y="418" width="300" height="86" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="1.5"/>
      <text x="710" y="196" fill="${INK}" font-family="monospace" font-size="18">KIWIX · WIKIPÉDIA</text>
      <text x="710" y="332" fill="${INK}" font-family="monospace" font-size="18">APOSTILAS EM PDF</text>
      <text x="710" y="468" fill="${INK}" font-family="monospace" font-size="18">VÍDEOS ABERTOS</text>
      `,
      'SALA DE AULA · BIBLIOTECAS DIGITAIS OFFLINE',
    ),
  },
  {
    key: 'cover-acessibilidade-digital',
    filename: 'capa-acessibilidade-digital.png',
    alt: 'Ondas sonoras e anéis de foco por teclado representando acessibilidade com leitores de tela livres',
    credit: 'Ilustração editorial GNUverse · CC BY-SA 4.0',
    svg: frame(
      `
      <rect x="200" y="210" width="320" height="220" rx="10" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2.5"/>
      <rect x="228" y="248" width="120" height="44" rx="6" fill="${RAISED}" stroke="${ACCENT}" stroke-width="2"/>
      <text x="262" y="276" fill="${ACCENT}" font-family="monospace" font-size="20">TAB</text>
      <rect x="228" y="316" width="264" height="14" rx="3" fill="${INK}"/>
      <rect x="228" y="348" width="210" height="12" rx="3" fill="${MUTED}"/>
      <rect x="228" y="376" width="240" height="12" rx="3" fill="${LINE}"/>
      <g fill="${ACCENT}">
        <rect x="610" y="290" width="14" height="60" rx="7" opacity="0.5"/>
        <rect x="646" y="250" width="14" height="140" rx="7" opacity="0.75"/>
        <rect x="682" y="210" width="14" height="220" rx="7"/>
        <rect x="718" y="240" width="14" height="160" rx="7" opacity="0.85"/>
        <rect x="754" y="270" width="14" height="100" rx="7" opacity="0.7"/>
        <rect x="790" y="230" width="14" height="180" rx="7" opacity="0.9"/>
        <rect x="826" y="265" width="14" height="110" rx="7" opacity="0.75"/>
        <rect x="862" y="295" width="14" height="50" rx="7" opacity="0.5"/>
      </g>
      <text x="610" y="472" fill="${MUTED}" font-family="monospace" font-size="18">ORCA · SEMÂNTICA HTML · TECLADO</text>
      `,
      'INCLUSÃO DIGITAL · LEITORES DE TELA LIVRES',
    ),
  },
  // In-article body figures (embedded via Lexical upload nodes)
  {
    key: 'figure-quatro-liberdades',
    filename: 'figura-quatro-liberdades.png',
    alt: 'Fluxograma conectando as quatro liberdades do software livre ao ciclo de aprendizado e compartilhamento comunitário',
    credit: 'Diagrama: ciclo de autonomia no software livre · GNUverse (CC BY-SA 4.0)',
    svg: frame(
      `
      <g transform="translate(110, 150)">
        <rect x="0" y="0" width="210" height="150" rx="8" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
        <text x="24" y="46" fill="${ACCENT}" font-family="monospace" font-size="20">0 · USAR</text>
        <text x="24" y="86" fill="${MUTED}" font-family="sans-serif" font-size="17">Sem restrição de</text>
        <text x="24" y="112" fill="${MUTED}" font-family="sans-serif" font-size="17">licença por assento</text>

        <rect x="255" y="0" width="210" height="150" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
        <text x="279" y="46" fill="${INK}" font-family="monospace" font-size="20">1 · ESTUDAR</text>
        <text x="279" y="86" fill="${MUTED}" font-family="sans-serif" font-size="17">Código aberto para</text>
        <text x="279" y="112" fill="${MUTED}" font-family="sans-serif" font-size="17">auditoria e ensino</text>

        <rect x="510" y="0" width="210" height="150" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
        <text x="534" y="46" fill="${INK}" font-family="monospace" font-size="20">2 · COPIAR</text>
        <text x="534" y="86" fill="${MUTED}" font-family="sans-serif" font-size="17">Compartilhar com</text>
        <text x="534" y="112" fill="${MUTED}" font-family="sans-serif" font-size="17">turmas e vizinhos</text>

        <rect x="765" y="0" width="210" height="150" rx="8" fill="${SURFACE}" stroke="${CORAL}" stroke-width="2"/>
        <text x="789" y="46" fill="${CORAL}" font-family="monospace" font-size="20">3 · MELHORAR</text>
        <text x="789" y="86" fill="${MUTED}" font-family="sans-serif" font-size="17">Devolver traduções</text>
        <text x="789" y="112" fill="${MUTED}" font-family="sans-serif" font-size="17">e correções ao bem</text>

        <g stroke="${ACCENT}" stroke-width="2">
          <line x1="210" y1="75" x2="255" y2="75"/>
          <line x1="465" y1="75" x2="510" y2="75"/>
          <line x1="720" y1="75" x2="765" y2="75"/>
        </g>
        <path d="M 870 150 L 870 250 L 105 250 L 105 150" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="6 6"/>
        <text x="330" y="290" fill="${INK}" font-family="monospace" font-size="18">CICLO CONTÍNUO DE CONHECIMENTO COMPARTILHADO</text>
      </g>
      `,
      'DIAGRAMA 01 · AS QUATRO LIBERDADES NA PRÁTICA',
    ),
  },
  {
    key: 'figure-arquitetura-lab-livre',
    filename: 'figura-arquitetura-lab-livre.png',
    alt: 'Arquitetura de um laboratório escolar com espelho local de pacotes Debian e estações leves',
    credit: 'Diagrama: reaproveitamento de laboratório escolar com GNU/Linux · GNUverse (CC BY-SA 4.0)',
    svg: frame(
      `
      <rect x="140" y="170" width="260" height="270" rx="8" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
      <text x="172" y="220" fill="${ACCENT}" font-family="monospace" font-size="20">ESPELHO LOCAL</text>
      <text x="172" y="262" fill="${INK}" font-family="sans-serif" font-size="17">apt-cacher-ng</text>
      <text x="172" y="294" fill="${MUTED}" font-family="sans-serif" font-size="16">ISO Debian Stable</text>
      <text x="172" y="324" fill="${MUTED}" font-family="sans-serif" font-size="16">Pacotes didáticos</text>
      <text x="172" y="354" fill="${MUTED}" font-family="sans-serif" font-size="16">Atualização offline</text>

      <g stroke="${ACCENT}" stroke-width="2">
        <line x1="400" y1="240" x2="540" y2="210"/>
        <line x1="400" y1="305" x2="540" y2="305"/>
        <line x1="400" y1="370" x2="540" y2="400"/>
      </g>

      <rect x="540" y="160" width="520" height="90" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="1.5"/>
      <text x="572" y="200" fill="${INK}" font-family="monospace" font-size="18">ESTAÇÕES 01–06 · PROGRAMAÇÃO</text>
      <text x="572" y="228" fill="${MUTED}" font-family="sans-serif" font-size="16">GCC, Python, Git e editor leve em 4 GB de RAM</text>

      <rect x="540" y="265" width="520" height="90" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="1.5"/>
      <text x="572" y="305" fill="${INK}" font-family="monospace" font-size="18">ESTAÇÕES 07–12 · CRIAÇÃO MULTIMÍDIA</text>
      <text x="572" y="333" fill="${MUTED}" font-family="sans-serif" font-size="16">GIMP, Inkscape, Audacity e LibreOffice</text>

      <rect x="540" y="370" width="520" height="90" rx="8" fill="${SURFACE}" stroke="${CORAL}" stroke-width="1.5"/>
      <text x="572" y="410" fill="${CORAL}" font-family="monospace" font-size="18">BANCADA DE MANUTENÇÃO COLETIVA</text>
      <text x="572" y="438" fill="${MUTED}" font-family="sans-serif" font-size="16">Estudantes diagnosticam disco, memória e rede</text>
      `,
      'DIAGRAMA 02 · LABORATÓRIO ESCOLAR COM SOFTWARE LIVRE',
    ),
  },
  {
    key: 'figure-rede-comunitaria',
    filename: 'figura-rede-comunitaria.png',
    alt: 'Topologia de rede comunitária com roteadores livres OpenWrt e serviços hospedados localmente',
    credit: 'Diagrama: topologia de rede comunitária e acervo local · GNUverse (CC BY-SA 4.0)',
    svg: frame(
      `
      <rect x="120" y="210" width="230" height="190" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
      <text x="148" y="258" fill="${MUTED}" font-family="monospace" font-size="18">LINK EXTERNO</text>
      <text x="148" y="294" fill="${INK}" font-family="sans-serif" font-size="17">Opcional /</text>
      <text x="148" y="320" fill="${INK}" font-family="sans-serif" font-size="17">Intermitente</text>

      <line x1="350" y1="305" x2="470" y2="305" stroke="${MUTED}" stroke-width="2" stroke-dasharray="6 6"/>

      <rect x="470" y="180" width="260" height="250" rx="8" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2.5"/>
      <text x="502" y="230" fill="${ACCENT}" font-family="monospace" font-size="20">ROTEADOR LIVRE</text>
      <text x="502" y="268" fill="${INK}" font-family="sans-serif" font-size="17">Firmware OpenWrt</text>
      <text x="502" y="298" fill="${MUTED}" font-family="sans-serif" font-size="16">Malha Wi-Fi local</text>
      <text x="502" y="328" fill="${MUTED}" font-family="sans-serif" font-size="16">DNS comunitário</text>
      <text x="502" y="358" fill="${MUTED}" font-family="sans-serif" font-size="16">Gestão coletiva</text>

      <line x1="730" y1="255" x2="850" y2="215" stroke="${ACCENT}" stroke-width="2"/>
      <line x1="730" y1="355" x2="850" y2="395" stroke="${ACCENT}" stroke-width="2"/>

      <rect x="850" y="160" width="240" height="110" rx="8" fill="${RAISED}" stroke="${ACCENT}" stroke-width="1.5"/>
      <text x="876" y="206" fill="${INK}" font-family="monospace" font-size="17">BIBLIOTECA LOCAL</text>
      <text x="876" y="236" fill="${MUTED}" font-family="sans-serif" font-size="15">Wiki, livros e aulas</text>

      <rect x="850" y="340" width="240" height="110" rx="8" fill="${RAISED}" stroke="${CORAL}" stroke-width="1.5"/>
      <text x="876" y="386" fill="${CORAL}" font-family="monospace" font-size="17">COMUNICAÇÃO</text>
      <text x="876" y="416" fill="${MUTED}" font-family="sans-serif" font-size="15">Rádio e fórum do bairro</text>
      `,
      'DIAGRAMA 03 · REDE EM MALHA E SERVIÇOS LOCAIS',
    ),
  },
  {
    key: 'figure-fluxo-acessibilidade',
    filename: 'figura-fluxo-acessibilidade.png',
    alt: 'Fluxo técnico da semântica HTML até a leitura em voz alta por leitores de tela livres como o Orca',
    credit: 'Diagrama: da semântica HTML ao leitor de tela livre · GNUverse (CC BY-SA 4.0)',
    svg: frame(
      `
      <rect x="130" y="210" width="260" height="200" rx="8" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
      <text x="160" y="256" fill="${ACCENT}" font-family="monospace" font-size="19">1 · HTML SEMÂNTICO</text>
      <text x="160" y="294" fill="${INK}" font-family="monospace" font-size="16">&lt;main&gt;, &lt;nav&gt;, &lt;h1&gt;</text>
      <text x="160" y="324" fill="${MUTED}" font-family="sans-serif" font-size="16">Hierarquia clara e</text>
      <text x="160" y="350" fill="${MUTED}" font-family="sans-serif" font-size="16">alt descritivo</text>

      <line x1="390" y1="310" x2="470" y2="310" stroke="${ACCENT}" stroke-width="2"/>

      <rect x="470" y="210" width="260" height="200" rx="8" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="2"/>
      <text x="500" y="256" fill="${ACCENT}" font-family="monospace" font-size="19">2 · FOCO E TECLADO</text>
      <text x="500" y="294" fill="${INK}" font-family="monospace" font-size="16">Tab / Shift+Tab</text>
      <text x="500" y="324" fill="${MUTED}" font-family="sans-serif" font-size="16">:focus-visible nítido</text>
      <text x="500" y="350" fill="${MUTED}" font-family="sans-serif" font-size="16">sem armadilhas</text>

      <line x1="730" y1="310" x2="810" y2="310" stroke="${ACCENT}" stroke-width="2"/>

      <rect x="810" y="210" width="260" height="200" rx="8" fill="${SURFACE}" stroke="${CORAL}" stroke-width="2"/>
      <text x="840" y="256" fill="${CORAL}" font-family="monospace" font-size="19">3 · LEITOR ORCA</text>
      <text x="840" y="294" fill="${INK}" font-family="sans-serif" font-size="17">Leitura previsível</text>
      <text x="840" y="324" fill="${MUTED}" font-family="sans-serif" font-size="16">em voz alta e braille</text>
      <text x="840" y="350" fill="${MUTED}" font-family="sans-serif" font-size="16">com software livre</text>
      `,
      'DIAGRAMA 04 · ACESSIBILIDADE COMO PRÁTICA CONTÍNUA',
    ),
  },
]
