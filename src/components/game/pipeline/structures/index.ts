/** Side-effect imports register every placeable structure. */
import './belt.ts'
import './fast-belt.ts'
import './combiner.ts'
import './splitter.ts'
import './tunnel.ts'
import './fast-tunnel.ts'

export { defaultStructureId, getStructure, listStructures, registerStructure } from './registry.ts'
export type {
  StructureCommitContext,
  StructureDefinition,
  StructureHoverGhost,
  StructurePlaceRequest,
  StructurePlacementSession,
  StructurePreviewBelt,
  StructurePreviewMachine,
} from './types.ts'
