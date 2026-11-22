export type SavedCamera = { worldX: number; worldY: number; zoom: number }

const KEY_PREFIX = 'gnuverse.pipeline.camera.v1:'

export function cameraStorageKey(roomId: string, userId?: string | null): string {
  return `${KEY_PREFIX}${roomId}:${userId || 'guest'}`
}

function isSavedCamera(value: unknown): value is SavedCamera {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.worldX === 'number' &&
    Number.isFinite(record.worldX) &&
    typeof record.worldY === 'number' &&
    Number.isFinite(record.worldY) &&
    typeof record.zoom === 'number' &&
    Number.isFinite(record.zoom)
  )
}

export function loadSavedCamera(roomId: string, userId?: string | null): SavedCamera | null {
  try {
    const raw = localStorage.getItem(cameraStorageKey(roomId, userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSavedCamera(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveSavedCamera(
  roomId: string,
  userId: string | null | undefined,
  camera: SavedCamera,
): void {
  try {
    localStorage.setItem(cameraStorageKey(roomId, userId), JSON.stringify(camera))
  } catch {
    // Private mode, quota, or other storage errors.
  }
}