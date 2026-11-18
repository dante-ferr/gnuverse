import type { EditMode } from './scene/pipeline-scene'
import { listStructures } from './structures'
import styles from '../game-shell.module.css'

type Props = {
  selectedStructureId: string
  onSelectStructure: (id: string) => void
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
}

/** Placeable structures from the registry, plus create/delete mode. */
export function StructurePalette({
  selectedStructureId,
  onSelectStructure,
  editMode,
  onEditModeChange,
}: Props) {
  const structures = listStructures()

  return (
    <section className={styles.structurePalette} aria-labelledby="structure-palette-heading">
      <h2 id="structure-palette-heading" className={styles.sidebarSectionTitle}>
        Estruturas
      </h2>
      <div className={styles.structureList} role="list">
        {structures.map((structure) => {
          const selected = structure.id === selectedStructureId
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
            </button>
          )
        })}
      </div>
      <div className={styles.editModeRow} role="group" aria-label="Modo de edição">
        <button
          type="button"
          className={styles.editModeButton}
          aria-pressed={editMode === 'create'}
          onClick={() => onEditModeChange('create')}
        >
          Criar
        </button>
        <button
          type="button"
          className={styles.editModeButton}
          aria-pressed={editMode === 'delete'}
          onClick={() => onEditModeChange('delete')}
        >
          Apagar
        </button>
      </div>
      <p className={styles.controlsHint}>
        Pressione E para alternar. WASD, setas ou botão direito movem a câmera.
      </p>
    </section>
  )
}
