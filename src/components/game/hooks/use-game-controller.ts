'use client'

import { useEffect, useState } from 'react'
import { COLORS } from '../model/block-catalog'
import {
  type BlockKind,
  type Proposal,
  type Snapshot,
  type Tower,
  type Wallet,
} from '../model/types'
import { useGameSession } from './use-game-session'
import { useTowerLobby } from './use-tower-lobby'
import { useTowerStream } from './use-tower-stream'
import { useActionFeedback } from './use-action-feedback'
export type ProposalTarget = { type: 'restore' | 'ban'; targetId: string }

/** Composes application actions; domain transport and stream lifecycles stay separate. */
export function useGameController() {
  const session = useGameSession()
  const lobby = useTowerLobby(session.api)
  const live = useTowerStream(session.api, lobby.towerId)
  const feedback = useActionFeedback()
  const [placement, setPlacement] = useState({
    kind: 'wide' as BlockKind,
    color: COLORS[0],
    x: 500,
    y: 180,
    angle: 0,
  })
  const [preview, setPreview] = useState<Snapshot | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register')
  const [showAuth, setShowAuth] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [proposalTarget, setProposalTarget] = useState<ProposalTarget | null>(
    null,
  )
  const [tab, setTab] = useState<'history' | 'community' | 'decisions'>(
    'history',
  )
  useEffect(() => {
    setPreview(null)
    setProposalTarget(null)
  }, [lobby.towerId])
  const tower = live.state?.tower || null
  const member = live.state?.members.find(
    (person) => person.id === session.user?.id,
  )
  const rules = live.state?.rules || lobby.rules
  const connection = lobby.towerId ? live.connection : lobby.connection
  const canPlace = Boolean(
    session.user &&
    tower &&
    !member?.banned &&
    live.frame.blocks.length < Number(rules?.maxBlocks ?? 100) &&
    !live.frame.checkpointPending &&
    !(live.frame.cooldownRemainingMs && live.frame.cooldownRemainingMs > 0) &&
    !live.frame.wind &&
    !feedback.busy &&
    !preview &&
    connection === 'live' &&
    session.wallet &&
    session.wallet.balance >= tower.cost,
  )

  const authenticate = (form: HTMLFormElement) =>
    feedback.run(async () => {
      await session.authenticate(authMode, form)
      setShowAuth(false)
      feedback.setNotice('')
    })
  const logout = () => feedback.run(session.logout)
  const place = () =>
    feedback.run(async () => {
      if (!canPlace) return
      const result = await session.api.request<{ wallet: Wallet }>(
        `/api/towers/${lobby.towerId}/blocks`,
        { ...placement, angle: (placement.angle * Math.PI) / 180 },
      )
      session.setWallet(result.wallet)
      live.setFrame((frame) => ({
        ...frame, settled: false,
        cooldownRemainingMs: tower?.blockIntervalMs ?? 0,
        checkpointPending: (frame.blocksUntilCheckpoint ?? 1) <= 1,
      }))
      feedback.setNotice('')
      await live.refresh()
    })
  const createTower = (form: HTMLFormElement) =>
    feedback.run(async () => {
      const data = new FormData(form)
      const result = await session.api.request<{ tower: Tower }>(
        '/api/towers',
        {
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
        },
      )
      await lobby.refresh()
      lobby.setTowerId(result.tower.id)
      setShowCreate(false)
      feedback.setNotice('Torre criada.')
    })
  const openProposal = (target: ProposalTarget, version?: Snapshot) => {
    if (version) setPreview(version)
    setProposalTarget(target)
  }
  const propose = (reason: string) =>
    feedback.run(async () => {
      if (!proposalTarget) return
      await session.api.request(`/api/towers/${lobby.towerId}/proposals`, {
        ...proposalTarget,
        reason,
      })
      setProposalTarget(null)
      setTab('decisions')
      await live.refresh()
      feedback.setNotice('Proposta registrada.')
    })
  const vote = (proposal: Proposal, choice: string) =>
    feedback.run(async () => {
      await session.api.request(
        `/api/towers/${lobby.towerId}/proposals/${proposal.id}/vote`,
        { choice },
      )
      await live.refresh()
    })
  const decide = (proposal: Proposal, accept: boolean, reason: string) =>
    feedback.run(async () => {
      await session.api.request(
        `/api/towers/${lobby.towerId}/proposals/${proposal.id}/decide`,
        { accept, reason },
      )
      await live.refresh()
    })
  const setEligibility = (userId: string, eligible: boolean) =>
    feedback.run(async () => {
      await session.api.request(
        `/api/towers/${lobby.towerId}/members/${userId}/eligibility`,
        { eligible },
      )
      await live.refresh()
    })
  const saveSettings = (body: Record<string, string | number>) =>
    feedback.run(async () => {
      await session.api.request(`/api/towers/${lobby.towerId}/settings`, body)
      await live.refresh()
      await lobby.refresh()
      feedback.setNotice('Regras atualizadas.')
    })
  return {
    session,
    lobby,
    live,
    feedback,
    placement,
    setPlacement,
    preview,
    setPreview,
    authMode,
    setAuthMode,
    showAuth,
    setShowAuth,
    showCreate,
    setShowCreate,
    proposalTarget,
    setProposalTarget,
    tab,
    setTab,
    tower,
    member,
    rules,
    connection,
    canPlace,
    authenticate,
    logout,
    place,
    createTower,
    openProposal,
    propose,
    vote,
    decide,
    setEligibility,
    saveSettings,
  }
}
export type GameController = ReturnType<typeof useGameController>
