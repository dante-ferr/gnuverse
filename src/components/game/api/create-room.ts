import type { GameApi } from './game-api'
import type { Room } from '../model/types'

export function createRoomFromForm(api: GameApi, form: HTMLFormElement) {
  const data = new FormData(form)
  return api.request<{ room: Room }>('/api/towers', {
    name: data.get('name'),
    cost: Number(data.get('cost')),
    eligibilityMode: data.get('eligibilityMode') ?? 'automatic',
    minContributions: Number(data.get('minContributions')),
    allowCreatorBan: data.get('allowCreatorBan') === 'on',
    sandbox: data.get('sandbox') === 'true' ? true : undefined,
  })
}

export function createSandboxRoom(api: GameApi) {
  return api.request<{ room: Room }>('/api/towers', { sandbox: true })
}