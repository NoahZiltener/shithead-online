import type { ClientGameState, OpponentView, SelfView } from '../../../shared/src/types.ts'
import type { ServerGameState } from './types.ts'

export function getClientState(state: ServerGameState, viewerId: string): ClientGameState {
  const player = state.players.find((p) => p.id === viewerId)
  if (!player) throw new Error('Player not found')

  const self: SelfView = {
    id: player.id,
    name: player.name,
    hand: player.hand,
    faceUp: player.faceUp,
    faceDownCount: player.faceDown.length,
    faceDownIds: player.faceDown.map((_, i) => `fd_${i}`),
    isFinished: player.isFinished,
    hasSetFaceUp: player.hasSetFaceUp,
  }

  const opponents: OpponentView[] = state.players
    .filter((p) => p.id !== viewerId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      faceUp: p.faceUp,
      faceDownCount: p.faceDown.length,
      isFinished: p.isFinished,
    }))

  return {
    self,
    opponents,
    drawPileCount: state.drawPile.length,
    discardPile: state.discardPile,
    effectiveTop: state.effectiveTop,
    constraint: state.constraint,
    currentPlayerId: state.players[state.currentPlayerIndex]?.id ?? null,
    phase: state.phase,
    finishedPlayerIds: state.finishedPlayerIds,
    loser: state.loser,
  }
}
