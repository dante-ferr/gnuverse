/** Side-effect imports register every placeable structure. */
import './belt.ts'

export { defaultStructureId, getStructure, listStructures, registerStructure } from './registry.ts'
export type {
  StructureCommitContext,
  StructureDefinition,
  StructurePlaceRequest,
  StructurePlacementSession,
  StructurePreviewBelt,
} from './types.ts'
