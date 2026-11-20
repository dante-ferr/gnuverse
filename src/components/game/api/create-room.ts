import type { GameApi } from './game-api'
import type { Room } from '../model/types'

export function createRoomFromForm(api: GameApi, form: HTMLFormElement) {
  const data = new FormData(form)
  return api.request<{ room: Room }>('/api/towers', {
    name: data.get('name'),
    eligibilityMode: data.get('eligibilityMode') ?? 'automatic',
    minContributions: Number(data.get('minContributions')),
    sandbox: data.get('sandbox') === 'true' ? true : undefined,
  })
}

export function createSandboxRoom(api: GameApi) {
  return api.request<{ room: Room }>('/api/towers', { sandbox: true })
}
