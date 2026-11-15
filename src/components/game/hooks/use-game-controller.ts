'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { canManageTower } from '../../../../core/authz/policy'
import { createTowerFromForm } from '../api/create-tower'
import { type Proposal, type Wallet, type TreeNode } from '../model/types'
import { parseTreeRules } from '../model/tree-rules'
import type { GrowAnchor, GameCamera } from '../construction/tree-scene/index.ts'
import { useGameSession } from './use-game-session'
import { useTowerLobby } from './use-tower-lobby'
import { useTowerStream } from './use-tower-stream'
import { useActionFeedback } from './use-action-feedback'
export type ProposalTarget = { type: 'ban'; targetId: string }

/** Composes application actions; domain transport and stream lifecycles stay separate. */
export function useGameController() {
  const router = useRouter()
  const session = useGameSession()
  const lobby = useTowerLobby(session.api)
  const live = useTowerStream(session.api, lobby.towerId)
  const feedback = useActionFeedback()
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const [growAnchor, setGrowAnchor] = useState<GrowAnchor | null>(null)
  const [growPreview, setGrowPreview] = useState<{ x: number; y: number } | null>(null)
  const [camera, setCameraState] = useState<GameCamera>({ x: 0, y: 0, zoom: 1 })
  const setCamera = (patch: Partial<GameCamera>) =>
    setCameraState((prev) => ({ ...prev, ...patch }))
  const [showCreate, setShowCreate] = useState(false)
  const [proposalTarget, setProposalTarget] = useState<ProposalTarget | null>(null)
  const [tab, setTab] = useState<'community' | 'decisions'>('community')
  useEffect(() => {
    setProposalTarget(null)
    setSelected(null)
    setGrowAnchor(null)
    setGrowPreview(null)
    setCameraState({ x: 0, y: 0, zoom: 1 })
  }, [lobby.towerId])
  const tower = live.state?.tower || null
  const member = live.state?.members.find((person) => person.id === session.user?.id)
  const rules = live.state?.rules || lobby.rules
  const treeRules = parseTreeRules(rules)
  const connection = lobby.towerId ? live.connection : lobby.connection
  const canAct = Boolean(
    session.user &&
      tower &&
      !member?.banned &&
      live.frame.outcome === 'playing' &&
      live.frame.turn.phase !== 'physics' &&
      !feedback.busy &&
      connection === 'live' &&
      session.wallet &&
      session.wallet.balance >= 1,
  )

  const logout = () => feedback.run(session.logout)
  const perform = (path: string, body: Record<string, unknown>) =>
    feedback.run(async () => {
      const result = await session.api.request<{ wallet: Wallet }>(
        `/api/towers/${lobby.towerId}/${path}`,
        body,
      )
      session.setWallet(result.wallet)
      await live.refresh()
    })
  const growCommit = (point: { x: number; y: number }) => {
    if (!growAnchor) return
    const anchor = growAnchor
    void feedback.run(async () => {
      const result = await session.api.request<{ wallet: Wallet }>(
        `/api/towers/${lobby.towerId}/grow`,
        {
          segmentId: anchor.segmentId,
          anchorX: anchor.x,
          anchorY: anchor.y,
          x: point.x,
          y: point.y,
        },
      )
      session.setWallet(result.wallet)
      await live.refresh()
      setGrowAnchor(null)
      setGrowPreview(null)
    })
  }
  const createTower = (form: HTMLFormElement) =>
    feedback.run(async () => {
      const result = await createTowerFromForm(session.api, form)
      await lobby.refresh()
      lobby.setTowerId(result.tower.id)
      setShowCreate(false)
      feedback.setNotice('Caverna criada.')
    })
  const deleteTower = () =>
    feedback.run(async () => {
      if (!tower || !canManageTower(session.user ? { ...session.user, roles: session.user.roles ?? [] } : null, 'delete', tower.creatorId)) return
      await session.api.request(`/api/towers/${lobby.towerId}`, undefined, 'DELETE')
      router.push('/jogo/')
    })
  const openProposal = (target: ProposalTarget) => setProposalTarget(target)
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
  const saveSettings = (body: Record<string, string | number | boolean>) =>
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
    selected,
    setSelected,
    growAnchor,
    setGrowAnchor,
    growPreview,
    setGrowPreview,
    camera,
    setCamera,
    showCreate,
    setShowCreate,
    proposalTarget,
    setProposalTarget,
    tab,
    setTab,
    tower,
    member,
    rules,
    treeRules,
    connection,
    canAct,
    logout,
    growCommit,
    createTower,
    deleteTower,
    openProposal,
    propose,
    decide,
    setEligibility,
    saveSettings,
    perform,
  }
}
export type GameController = ReturnType<typeof useGameController>