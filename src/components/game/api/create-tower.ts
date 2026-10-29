import type { GameApi } from './game-api'
import type { Tower } from '../model/types'

export function createTowerFromForm(api: GameApi, form: HTMLFormElement) {
  const data = new FormData(form)
  return api.request<{ tower: Tower }>('/api/towers', {
    name: data.get('name'),
    cost: Number(data.get('cost')),
    blockIntervalMs: Math.round(Number(data.get('blockIntervalSeconds')) * 1000),
    checkpointEveryBlocks: Number(data.get('checkpointEveryBlocks')),
    windMinBlocks: Number(data.get('windMinBlocks')),
    windEveryBlocks: Number(data.get('windEveryBlocks')),
    banMode: data.get('banMode'),
    restoreMode: data.get('restoreMode'),
    eligibilityMode: data.get('eligibilityMode'),
    minContributions: Number(data.get('minContributions')),
    allowCreatorBan: data.get('allowCreatorBan') === 'on',
  })
}
