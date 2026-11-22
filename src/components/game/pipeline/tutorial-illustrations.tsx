import type { CSSProperties, ReactNode } from 'react'
import { darkenHex } from './scene/painters/darken-hex'
import { glyphUrlForShape, type PipelineRules } from './model/frame'
import { getStructure } from './structures'
import styles from './room-tutorial-overlay.module.css'

type IllustrationProps = {
  className?: string
  rules: PipelineRules | null
}

function ArtMask({
  src,
  color,
  className,
  label,
}: {
  src: string
  color: string
  className?: string
  label?: string
}) {
  return (
    <span
      className={className}
      style={
        {
          maskImage: `url(${src})`,
          WebkitMaskImage: `url(${src})`,
          backgroundColor: color,
        } as CSSProperties
      }
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}

function MachinePlate({
  body,
  decorSrc,
  decorColor,
  outline,
  shape = 'rect',
  size = 'md',
  children,
  label,
}: {
  body: string
  decorSrc: string
  decorColor: string
  outline?: string
  shape?: 'rect' | 'circle'
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  label: string
}) {
  return (
    <div className={styles.machineWrap}>
      <div
        className={`${styles.machinePlate} ${styles[`machine_${size}`]} ${
          shape === 'circle' ? styles.machineCircle : ''
        }`}
        style={{
          backgroundColor: body,
          borderColor: outline ?? '#0a1012',
        }}
        role="img"
        aria-label={label}
      >
        <ArtMask src={decorSrc} color={decorColor} className={styles.machineDecor} />
        {children}
      </div>
      <span className={styles.caption}>{label}</span>
    </div>
  )
}

function StructureChip({
  structureId,
  ink,
}: {
  structureId: string
  ink: string
}) {
  const structure = getStructure(structureId)
  if (!structure) return null
  return (
    <div className={styles.chip}>
      <ArtMask src={structure.iconSrc} color={ink} className={styles.chipIcon} />
      <span className={styles.chipLabel}>{structure.label}</span>
    </div>
  )
}

function elementLook(rules: PipelineRules | null, id: string) {
  const el = rules?.elements.elements.find((item) => item.id === id)
  return {
    fill: el?.fill ?? rules?.colorPacket ?? '#52d6c9',
    glyph: glyphUrlForShape(rules, id) ?? '/pipeline/resource-circle.svg',
    name: el?.name_pt ?? id,
  }
}

function machineColor(rules: PipelineRules | null, id: string, fallback: string) {
  return rules?.elements.machines.find((item) => item.id === id)?.color ?? fallback
}

function decorInk(rules: PipelineRules | null, body: string) {
  return darkenHex(body, rules?.decorDarkenPercent ?? 35)
}

/** Source → belts → core using in-game decor and glyphs. */
export function GoalIllustration({ className, rules }: IllustrationProps) {
  const fire = elementLook(rules, 'fire')
  const sourceBody = fire.fill
  const coreBody = rules?.colorCore ?? '#ffffff'
  const accent = rules?.colorAccent ?? '#52d6c9'
  const belt = rules?.colorBelt ?? '#667b83'
  const chevron = rules?.colorBeltChevron ?? '#3e5056'
  const outline = rules?.colorOutline ?? '#0a1012'
  const ink = rules?.colorInk ?? '#edf4f4'

  return (
    <figure className={`${styles.stage} ${className ?? ''}`} aria-label="Fonte ligada ao núcleo">
      <MachinePlate
        body={sourceBody}
        decorSrc="/pipeline/source-decor.svg"
        decorColor={decorInk(rules, sourceBody)}
        outline={outline}
        shape="circle"
        size="lg"
        label="Fonte"
      >
        <ArtMask src={fire.glyph} color={fire.fill} className={styles.orbitGlyph} />
      </MachinePlate>
      <div className={styles.beltRun} aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={styles.beltCell} style={{ backgroundColor: belt }}>
            <span className={styles.beltChevron} style={{ color: chevron }} />
          </span>
        ))}
        <ArtMask
          src={fire.glyph}
          color={fire.fill}
          className={`${styles.packetGlyph} ${styles.packetMove}`}
        />
      </div>
      <MachinePlate
        body={coreBody}
        decorSrc="/pipeline/core-frame.svg"
        decorColor={decorInk(rules, coreBody)}
        outline={outline}
        size="lg"
        label="Núcleo"
      >
        <ArtMask
          src="/pipeline/core-gear-outer.svg"
          color={accent}
          className={`${styles.coreGear} ${styles.coreGearOuter}`}
        />
        <ArtMask
          src="/pipeline/core-gear-inner.svg"
          color={decorInk(rules, accent)}
          className={`${styles.coreGear} ${styles.coreGearInner}`}
        />
      </MachinePlate>
      <figcaption className={styles.srOnly}>
        Pacotes saem da fonte, andam nas esteiras e entram no núcleo.
      </figcaption>
      <span className={styles.flowHint} style={{ color: ink }}>
        Esteiras
      </span>
    </figure>
  )
}

/** Palette structures for belt placement. */
export function PlaceIllustration({ className, rules }: IllustrationProps) {
  const ink = rules?.colorInk ?? '#edf4f4'
  return (
    <figure className={`${styles.stage} ${styles.stageStack} ${className ?? ''}`}>
      <div className={styles.chipRow} role="list" aria-label="Esteiras na paleta">
        <StructureChip structureId="belt" ink={ink} />
        <StructureChip structureId="fast_belt" ink={rules?.colorFastBeltChevron ?? '#e85d4f'} />
      </div>
      <p className={styles.stageNote}>
        Escolha na paleta <strong>Estruturas</strong>, deixe <strong>Criar</strong> ativo e arraste
        na grade.
      </p>
    </figure>
  )
}

/** Splitter, tunnels, and trashcan with in-game art. */
export function LogisticsIllustration({ className, rules }: IllustrationProps) {
  const splitter = rules?.colorSplitter ?? '#c9a87c'
  const tunnel = rules?.colorTunnel ?? '#6d8490'
  const fastTunnel = rules?.colorFastTunnel ?? '#667b83'
  const fastDetail = rules?.colorFastBeltChevron ?? '#e85d4f'
  const trash = rules?.colorTrashcan ?? '#8b6540'
  const outline = rules?.colorOutline ?? '#0a1012'
  const ink = rules?.colorInk ?? '#edf4f4'

  return (
    <figure className={`${styles.stage} ${styles.stageStack} ${className ?? ''}`}>
      <div className={styles.machineRow}>
        <MachinePlate
          body={splitter}
          decorSrc="/pipeline/splitter-decor.svg"
          decorColor={decorInk(rules, splitter)}
          outline={outline}
          size="md"
          label="Divisor"
        />
        <MachinePlate
          body={tunnel}
          decorSrc="/pipeline/tunnel-entrance-decor.svg"
          decorColor={decorInk(rules, tunnel)}
          outline={outline}
          size="sm"
          label="Túnel"
        />
        <MachinePlate
          body={fastTunnel}
          decorSrc="/pipeline/tunnel-fast-entrance-decor.svg"
          decorColor={fastDetail}
          outline={outline}
          size="sm"
          label="Túnel rápido"
        />
        <MachinePlate
          body={trash}
          decorSrc="/pipeline/trashcan-decor.svg"
          decorColor={decorInk(rules, trash)}
          outline={outline}
          size="md"
          label="Lixeira"
        />
      </div>
      <div className={styles.chipRow} aria-hidden>
        <StructureChip structureId="splitter" ink={ink} />
        <StructureChip structureId="tunnel" ink={ink} />
        <StructureChip structureId="fast_tunnel" ink={fastDetail} />
        <StructureChip structureId="trashcan" ink={ink} />
      </div>
    </figure>
  )
}

/** Combiners craft new elements from inputs. */
export function CombinersIllustration({ className, rules }: IllustrationProps) {
  const bi = machineColor(rules, 'combiner_2', '#6eb8c9')
  const tri = machineColor(rules, 'combiner_3', '#c9a87c')
  const fire = elementLook(rules, 'fire')
  const water = elementLook(rules, 'water')
  const steam = elementLook(rules, 'steam')
  const outline = rules?.colorOutline ?? '#0a1012'
  const ink = rules?.colorInk ?? '#edf4f4'
  const biDecor =
    rules?.elements.machines.find((item) => item.id === 'combiner_2')?.decor ??
    '/pipeline/combiner-2-decor.svg'
  const triDecor =
    rules?.elements.machines.find((item) => item.id === 'combiner_3')?.decor ??
    '/pipeline/combiner-3-decor.svg'

  return (
    <figure className={`${styles.stage} ${styles.stageStack} ${className ?? ''}`}>
      <div className={styles.machineRow}>
        <MachinePlate
          body={bi}
          decorSrc={biDecor.startsWith('/') ? biDecor : `/${biDecor}`}
          decorColor={decorInk(rules, bi)}
          outline={outline}
          size="lg"
          label="Combinador"
        >
          <ArtMask src={steam.glyph} color={steam.fill} className={styles.orbitGlyph} />
        </MachinePlate>
        <MachinePlate
          body={tri}
          decorSrc={triDecor.startsWith('/') ? triDecor : `/${triDecor}`}
          decorColor={decorInk(rules, tri)}
          outline={outline}
          size="lg"
          label="Tri-combinador"
        />
      </div>
      <div className={styles.recipeRow} aria-label="Exemplo de receita">
        <ArtMask src={fire.glyph} color={fire.fill} className={styles.recipeGlyph} label={fire.name} />
        <span className={styles.recipeOp}>+</span>
        <ArtMask
          src={water.glyph}
          color={water.fill}
          className={styles.recipeGlyph}
          label={water.name}
        />
        <span className={styles.recipeOp}>→</span>
        <ArtMask
          src={steam.glyph}
          color={steam.fill}
          className={styles.recipeGlyph}
          label={steam.name}
        />
      </div>
      <div className={styles.chipRow} aria-hidden>
        <StructureChip structureId="combiner_2" ink={ink} />
        <StructureChip structureId="combiner_3" ink={ink} />
      </div>
    </figure>
  )
}

/** Core requirements with real element glyphs. */
export function RequirementsIllustration({ className, rules }: IllustrationProps) {
  const fire = elementLook(rules, 'fire')
  const water = elementLook(rules, 'water')
  return (
    <figure className={`${styles.stage} ${styles.stageStack} ${className ?? ''}`}>
      <div className={styles.reqPanel}>
        <p className={styles.reqTitle}>Requisitos do núcleo</p>
        <div className={styles.reqRow}>
          <ArtMask src={fire.glyph} color={fire.fill} className={styles.reqGlyph} />
          <span className={styles.reqBarTrack}>
            <span className={styles.reqBarFill} style={{ width: '60%', backgroundColor: fire.fill }} />
          </span>
          <span className={styles.reqCount}>12/20</span>
        </div>
        <div className={styles.reqRow}>
          <ArtMask src={water.glyph} color={water.fill} className={styles.reqGlyph} />
          <span className={styles.reqBarTrack}>
            <span
              className={styles.reqBarFill}
              style={{ width: '25%', backgroundColor: water.fill }}
            />
          </span>
          <span className={styles.reqCount}>5/20</span>
        </div>
      </div>
    </figure>
  )
}

/** Coins, map growth, camera, and help. */
export function ExploreIllustration({ className, rules }: IllustrationProps) {
  const fire = elementLook(rules, 'fire')
  const sourceBody = fire.fill
  const coreBody = rules?.colorCore ?? '#ffffff'
  const accent = rules?.colorAccent ?? '#52d6c9'
  const outline = rules?.colorOutline ?? '#0a1012'
  return (
    <figure className={`${styles.stage} ${styles.stageStack} ${className ?? ''}`}>
      <div className={styles.mapRow}>
        <div className={styles.mapChunkOwned}>
          <MachinePlate
            body={sourceBody}
            decorSrc="/pipeline/source-decor.svg"
            decorColor={decorInk(rules, sourceBody)}
            outline={outline}
            shape="circle"
            size="sm"
            label="Fonte"
          />
          <MachinePlate
            body={coreBody}
            decorSrc="/pipeline/core-frame.svg"
            decorColor={decorInk(rules, coreBody)}
            outline={outline}
            size="sm"
            label="Núcleo"
          />
        </div>
        <div className={styles.mapChunkPreview} aria-label="Trecho ainda bloqueado">
          <span className={styles.mapPreviewLabel}>Novo trecho</span>
        </div>
      </div>
      <div className={styles.exploreHints}>
        <span className={styles.keyCap}>WASD</span>
        <span className={styles.hintText}>move a visão</span>
        <span className={styles.helpBadge} style={{ backgroundColor: accent }}>
          ?
        </span>
        <span className={styles.hintText}>ajuda completa</span>
      </div>
    </figure>
  )
}
