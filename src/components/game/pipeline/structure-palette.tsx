import type { EditMode } from './scene/pipeline-scene'
import type { PipelineFrame, PipelineRules } from './model/frame'
import { getStructure, listStructures } from './structures'
import styles from '../game-shell.module.css'

function structurePriceLabel(
  id: string,
  rules: PipelineRules | null,
  sandbox: boolean,
): string | null {
  if (!rules) return null
  if (sandbox) return 'grátis'
  switch (id) {
    case 'belt':
      return `${rules.beltCost} / célula`
    case 'fast_belt':
      return `${rules.fastBeltCost} / célula`
    case 'splitter':
      return String(rules.splitterCost)
    case 'combiner_2':
    case 'combiner_3':
      return String(rules.combinerCost)
    case 'tunnel':
      return `${rules.tunnelCost} / par`
    case 'fast_tunnel':
      return `${rules.fastTunnelCost} / par`
    default:
      return null
  }
}

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
  selectedStructureId: string
  onSelectStructure: (id: string) => void
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  onRotate?: () => void
}

/** Placeable structures from the registry, plus create/delete mode. */
export function StructurePalette({
  frame,
  rules,
  selectedStructureId,
  onSelectStructure,
  editMode,
  onEditModeChange,
  onRotate,
}: Props) {
  const sandbox = frame?.sandbox === true
  const structures = listStructures().filter((item) => !item.sandboxOnly || sandbox)
  const canRotate = Boolean(getStructure(selectedStructureId)?.rotate)

  return (
    <section className={styles.structurePalette} aria-labelledby="structure-palette-heading">
      <h2 id="structure-palette-heading" className={styles.sidebarSectionTitle}>
        Estruturas
      </h2>
      <div className={styles.structureList} role="list">
        {structures.map((structure) => {
          const selected = structure.id === selectedStructureId
          const price = structurePriceLabel(structure.id, rules, sandbox)
          return (
            <button
              key={structure.id}
              type="button"
              className={styles.structureItem}
              aria-pressed={selected}
              role="listitem"
              onClick={() => onSelectStructure(structure.id)}
            >
              <span
                className={styles.structureIcon}
                style={{
                  maskImage: `url(${structure.iconSrc})`,
                  WebkitMaskImage: `url(${structure.iconSrc})`,
                }}
                aria-hidden
              />
              <span className={styles.structureLabel}>{structure.label}</span>
              {price ? <span className={styles.structureCost}>{price}</span> : null}
            </button>
          )
        })}
      </div>
      <div className={styles.editModeRow} role="group" aria-label="Modo de edição">
        <button
          type="button"
          className={styles.editModeButton}
          aria-pressed={editMode === 'create'}
          aria-keyshortcuts="E"
          title="Criar — E alterna com Apagar"
          onClick={() => onEditModeChange('create')}
        >
          Criar
        </button>
        <button
          type="button"
          className={styles.editModeButton}
          aria-pressed={editMode === 'delete'}
          aria-keyshortcuts="E"
          title="Apagar — E alterna com Criar"
          onClick={() => onEditModeChange('delete')}
        >
          Apagar
        </button>
        <button
          type="button"
          className={styles.editModeButton}
          disabled={!canRotate || editMode !== 'create'}
          aria-keyshortcuts="R"
          title="Girar (R)"
          onClick={() => onRotate?.()}
        >
          Girar
          <kbd className={styles.editModeHotkey}>R</kbd>
        </button>
      </div>
      <p className={styles.editModeHints}>
        <kbd className={styles.editModeHotkey}>E</kbd>
        <span>alterna criar e apagar</span>
      </p>
    </section>
  )
}
