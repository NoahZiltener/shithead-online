import { getLogger } from '@logtape/logtape'
import type { Card, PileConstraint } from '../../../shared/src/types.ts'
import { canPlayCard } from './rules.ts'
import type { PlayResult, ServerGameState, ServerPlayerState } from './types.ts'

const logger = getLogger(['shithead-online', 'game'])

type CardSource = 'hand' | 'faceUp' | 'faceDown'

function getCardSource(player: ServerPlayerState, drawPileEmpty: boolean): CardSource {
  if (player.hand.length > 0) return 'hand'
  if (drawPileEmpty && player.faceUp.length > 0) return 'faceUp'
  return 'faceDown'
}

function advanceTurn(state: ServerGameState, playAgain: boolean, skipNext: boolean): ServerGameState {
  if (playAgain) return state
  const n = state.players.length
  let next = (state.currentPlayerIndex + 1) % n
  while (state.players[next].isFinished) next = (next + 1) % n
  if (skipNext) {
    next = (next + 1) % n
    while (state.players[next].isFinished) next = (next + 1) % n
  }
  return { ...state, currentPlayerIndex: next }
}

function resolveKnownCards(
  player: ServerPlayerState,
  source: 'hand' | 'faceUp',
  cardIds: string[],
  state: ServerGameState,
): { cards: Card[]; newPlayer: ServerPlayerState } {
  const pool = source === 'hand' ? player.hand : player.faceUp
  const cardMap = new Map(pool.map((c) => [c.id, c]))
  const cards = cardIds.map((id) => {
    const c = cardMap.get(id)
    if (!c) throw new Error(`Card "${id}" not found in ${source}`)
    return c
  })
  const rank = cards[0].rank
  if (!cards.every((c) => c.rank === rank)) throw new Error('All played cards must be the same rank')
  if (!canPlayCard(cards[0], state.effectiveTop, state.constraint)) throw new Error('Cannot play this card on the current pile')
  const idSet = new Set(cardIds)
  const newPlayer = source === 'hand'
    ? { ...player, hand: player.hand.filter((c) => !idSet.has(c.id)) }
    : { ...player, faceUp: player.faceUp.filter((c) => !idSet.has(c.id)) }
  return { cards, newPlayer }
}

function drawToRefill(
  player: ServerPlayerState,
  drawPile: Card[],
): { player: ServerPlayerState; drawPile: Card[] } {
  let p = player
  let pile = drawPile
  while (p.hand.length < 3 && pile.length > 0) {
    p = { ...p, hand: [...p.hand, pile[0]] }
    pile = pile.slice(1)
  }
  return { player: p, drawPile: pile }
}

export function playCards(state: ServerGameState, playerId: string, cardIds: string[]): PlayResult {
  if (state.phase !== 'playing') throw new Error('Game not in playing phase')
  if (cardIds.length === 0) throw new Error('Must play at least one card')

  const playerIdx = state.currentPlayerIndex
  const player = state.players[playerIdx]
  if (player.id !== playerId) throw new Error('Not your turn')

  const drawPileEmpty = state.drawPile.length === 0
  const source = getCardSource(player, drawPileEmpty)

  if (source === 'faceDown') throw new Error('Face-down play not yet supported')

  const { cards, newPlayer } = resolveKnownCards(player, source, cardIds, state)

  const newDiscard = [...state.discardPile, ...cards]
  let newEffectiveTop: Card | null = cards[0].rank === 3 ? state.effectiveTop : cards[cards.length - 1]
  let newConstraint: PileConstraint = cards[0].rank === 3 ? state.constraint
    : cards[0].rank === 2 ? 'after2'
    : cards[0].rank === 7 ? 'after7'
    : 'none'

  let finalPlayer = newPlayer
  let newDrawPile = state.drawPile
  if (source === 'hand') {
    const drawn = drawToRefill(finalPlayer, newDrawPile)
    finalPlayer = drawn.player
    newDrawPile = drawn.drawPile
  }

  const isFinished = finalPlayer.hand.length === 0 && finalPlayer.faceUp.length === 0 && finalPlayer.faceDown.length === 0
  finalPlayer = { ...finalPlayer, isFinished }

  const newPlayers = [...state.players]
  newPlayers[playerIdx] = finalPlayer

  const newFinished = [...state.finishedPlayerIds]
  if (isFinished && !newFinished.includes(playerId)) newFinished.push(playerId)

  const skipNext = cards[0].rank === 8

  let newState: ServerGameState = {
    ...state,
    players: newPlayers,
    drawPile: newDrawPile,
    discardPile: newDiscard,
    effectiveTop: newEffectiveTop,
    constraint: newConstraint,
    finishedPlayerIds: newFinished,
  }

  newState = advanceTurn(newState, false, skipNext)
  logger.info('Turn: {playerName} played {count}x{rank} from {source}', { playerName: player.name, count: cards.length, rank: cards[0].rank, source })
  return { state: newState, burned: false, faceDownUnplayable: false, playerFinished: isFinished, gameOver: false }
}

export function pickUpPile(state: ServerGameState, playerId: string): ServerGameState {
  if (state.phase !== 'playing') throw new Error('Game not in playing phase')
  const playerIdx = state.currentPlayerIndex
  const player = state.players[playerIdx]
  if (player.id !== playerId) throw new Error('Not your turn')
  if (state.discardPile.length === 0) throw new Error('Discard pile is empty')

  const drawPileEmpty = state.drawPile.length === 0
  const source = getCardSource(player, drawPileEmpty)
  if (source === 'faceDown') throw new Error('In face-down phase: play a card instead')

  const activeCards = source === 'hand' ? player.hand : player.faceUp
  const hasPlayableCard = activeCards.some((c) => canPlayCard(c, state.effectiveTop, state.constraint))
  if (hasPlayableCard) throw new Error('You must play a card when you have a valid play')

  const newPlayer = { ...player, hand: [...player.hand, ...state.discardPile] }
  const newPlayers = [...state.players]
  newPlayers[playerIdx] = newPlayer
  let newState: ServerGameState = { ...state, players: newPlayers, discardPile: [], effectiveTop: null, constraint: 'none' }
  newState = advanceTurn(newState, false, false)
  logger.info('Turn: {playerName} picked up pile ({pileSize} cards)', { playerName: player.name, pileSize: state.discardPile.length })
  return newState
}
