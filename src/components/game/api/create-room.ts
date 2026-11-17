import type { GameApi } from './game-api'
import type { Tower } from '../model/types'

export function createTowerFromForm(api: GameApi, form: HTMLFormElement) {
  const data = new FormData(form)
  return api.request<{ tower: Tower }>('/api/towers', {
    name: data.get('name'),
    cost: Number(data.get('cost')),
    eligibilityMode: data.get('eligibilityMode') ?? 'automatic',
    minContributions: Number(data.get('minContributions')),
    allowCreatorBan: data.get('allowCreatorBan') === 'on',
  })
}