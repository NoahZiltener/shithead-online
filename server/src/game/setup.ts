import { getLogger } from '@logtape/logtape'
import type { ServerGameState } from './types.ts'

const logger = getLogger(['shithead-online', 'game'])

export function setFaceUp(state: ServerGameState, playerId: string, faceUpCardIds: string[]): ServerGameState {
  if (state.phase !== 'setup') { logger.warn('setFaceUp called outside setup phase by {playerId}', { playerId }); throw new Error('Not in setup phase') }
  if (faceUpCardIds.length !== 3) { logger.warn('Player {playerId} sent wrong face-up card count: {count}', { playerId, count: faceUpCardIds.length }); throw new Error('Must select exactly 3 face-up cards') }

  const idx = state.players.findIndex((p) => p.id === playerId)
  if (idx === -1) { logger.warn('setFaceUp: player {playerId} not found', { playerId }); throw new Error('Player not found') }
  const player = state.players[idx]
  if (player.hasSetFaceUp) { logger.warn('Player {playerId} tried to set face-up cards again', { playerId }); throw new Error('Already set face-up cards') }

  const idSet = new Set(faceUpCardIds)
  const faceUpCards = player.hand.filter((c) => idSet.has(c.id))
  if (faceUpCards.length !== 3) { logger.warn('Player {playerId} sent invalid face-up card IDs', { playerId }); throw new Error('Invalid card IDs for face-up') }

  // Remaining hand cards stay in hand; face-down was already assigned at deal time
  const hand = player.hand.filter((c) => !idSet.has(c.id))

  const newPlayers = [...state.players]
  newPlayers[idx] = { ...player, hand, faceUp: faceUpCards, hasSetFaceUp: true }

  const allReady = newPlayers.every((p) => p.hasSetFaceUp)
  if (allReady) logger.info('All players have set face-up cards, game entering playing phase')
  else logger.debug('Player {playerId} set face-up cards', { playerId })
  return { ...state, players: newPlayers, phase: allReady ? 'playing' : 'setup' }
}
