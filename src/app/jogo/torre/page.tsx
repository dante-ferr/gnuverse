import { TowerGame } from '@/components/game/tower-game'

export const metadata = {
  title: 'Torre colaborativa — GNUverse',
  description: 'Acompanhe o estado, construa blocos e participe das decisões da torre.',
}

export default function TowerPage() {
  return <TowerGame />
}
