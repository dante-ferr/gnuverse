/**
 * Re-export the canonical catalog loader used by the game-server.
 * Prefer importing from game-server/pipeline/elements/load-catalog.mjs directly.
 */

export {
  catalogToJson,
  defaultElementsConfigDir,
  loadElementCatalog,
} from '../../game-server/pipeline/elements/load-catalog.mjs'
