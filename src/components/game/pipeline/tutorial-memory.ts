/** Bump when tutorial content changes enough that players should see it again. */
const KEY = 'gnuverse.pipeline.tutorial.v2'

/** Whether this browser already finished or skipped the room tutorial. */
export function hasSeenRoomTutorial(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Persist that the player finished or skipped the room tutorial. */
export function markRoomTutorialSeen(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Private mode, quota, or other storage errors.
  }
}
