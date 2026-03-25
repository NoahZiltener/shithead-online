import { getLogger } from '@logtape/logtape'
import type { Card, PileConstraint } from '../../../shared/src/types.ts'
import { canPlayCard, checkFourOfAKind } from './rules.ts'
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

function parseFaceDownId(id: string): number {
  const match = id.match(/^fd_(\d+)$/)
  if (!match) return -1
  return parseInt(match[1], 10)
}

type FaceDownResolution =
  | { kind: 'playable'; cards: Card[]; newPlayer: ServerPlayerState; faceDownCard: Card }
  | { kind: 'unplayable'; result: PlayResult }

function resolveFaceDownPlay(
  state: ServerGameState,
  player: ServerPlayerState,
  playerIdx: number,
  cardIds: string[],
): FaceDownResolution {
  if (cardIds.length !== 1) throw new Error('Can only play one face-down card at a time')
  const fdIdx = parseFaceDownId(cardIds[0])
  if (fdIdx < 0 || fdIdx >= player.faceDown.length) throw new Error('Invalid face-down card index')

  const actualCard = player.faceDown[fdIdx]
  const newFaceDown = player.faceDown.filter((_, i) => i !== fdIdx)

  if (!canPlayCard(actualCard, state.effectiveTop, state.constraint)) {
    const pickedUp = [...state.discardPile, actualCard]
    const newPlayer = { ...player, hand: [...player.hand, ...pickedUp], faceDown: newFaceDown }
    const newPlayers = [...state.players]
    newPlayers[playerIdx] = newPlayer
    let newState: ServerGameState = { ...state, players: newPlayers, discardPile: [], effectiveTop: null, constraint: 'none' }
    newState = advanceTurn(newState, false, false)
    logger.info('Turn: {playerName} flipped unplayable face-down {rank} — picked up pile', { playerName: player.name, rank: actualCard.rank })
    return { kind: 'unplayable', result: { state: newState, burned: false, faceDownCard: actualCard, faceDownUnplayable: true, playerFinished: false, gameOver: false } }
  }

  return { kind: 'playable', cards: [actualCard], newPlayer: { ...player, faceDown: newFaceDown }, faceDownCard: actualCard }
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

function computePileUpdate(state: ServerGameState, cards: Card[]) {
  const newDiscard = [...state.discardPile, ...cards]
  const burnedByTen = cards[0].rank === 10
  const burnedByFour = !burnedByTen && checkFourOfAKind(newDiscard)
  const burned = burnedByTen || burnedByFour

  let newEffectiveTop = state.effectiveTop
  let newConstraint: PileConstraint = state.constraint
  if (burned) {
    newEffectiveTop = null
    newConstraint = 'none'
  } else if (cards[0].rank !== 3) {
    newEffectiveTop = cards[cards.length - 1]
    newConstraint = cards[0].rank === 2 ? 'after2' : cards[0].rank === 7 ? 'after7' : 'none'
  }

  return { newDiscard, burned, burnedByTen, burnedByFour, newEffectiveTop, newConstraint }
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

  let cards: Card[]
  let newPlayer: ServerPlayerState
  let faceDownCard: Card | undefined

  if (source === 'faceDown') {
    const resolution = resolveFaceDownPlay(state, player, playerIdx, cardIds)
    if (resolution.kind === 'unplayable') return resolution.result
    cards = resolution.cards
    newPlayer = resolution.newPlayer
    faceDownCard = resolution.faceDownCard
  } else {
    const resolved = resolveKnownCards(player, source, cardIds, state)
    cards = resolved.cards
    newPlayer = resolved.newPlayer
  }

  const { newDiscard, burned, newEffectiveTop, newConstraint } = computePileUpdate(state, cards)

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

  const skipNext = cards[0].rank === 8 && !burned
  const playAgain = burned && !isFinished

  let newState: ServerGameState = {
    ...state,
    players: newPlayers,
    drawPile: newDrawPile,
    discardPile: burned ? [] : newDiscard,
    effectiveTop: newEffectiveTop,
    constraint: newConstraint,
    finishedPlayerIds: newFinished,
  }

  newState = advanceTurn(newState, playAgain, skipNext)
  logger.info('Turn: {playerName} played {count}x{rank} from {source}', { playerName: player.name, count: cards.length, rank: cards[0].rank, source })
  return { state: newState, burned, faceDownCard, faceDownUnplayable: false, playerFinished: isFinished, gameOver: false }
}

export function throwInCards(state: ServerGameState, playerId: string, cardIds: string[]): PlayResult {
  if (state.phase !== 'playing') throw new Error('Game not in playing phase')
  if (cardIds.length === 0) throw new Error('Must play at least one card')

  const playerIdx = state.players.findIndex((p) => p.id === playerId)
  if (playerIdx === -1) throw new Error('Player not in game')
  const player = state.players[playerIdx]
  if (player.isFinished) throw new Error('You have already finished')
  if (playerIdx === state.currentPlayerIndex) throw new Error('It is your turn — use play_card instead')
  if (player.hand.length === 0) throw new Error('No cards in hand to throw in')

  const cardMap = new Map(player.hand.map((c) => [c.id, c]))
  const cards = cardIds.map((id) => {
    const c = cardMap.get(id)
    if (!c) throw new Error(`Card "${id}" not found in hand`)
    return c
  })
  const rank = cards[0].rank
  if (!cards.every((c) => c.rank === rank)) throw new Error('All thrown-in cards must be the same rank')

  if (state.discardPile.length === 0) throw new Error('Discard pile is empty')
  let topRank: number | null = null
  for (let i = state.discardPile.length - 1; i >= 0; i--) {
    if (state.discardPile[i].rank !== 3) { topRank = state.discardPile[i].rank; break }
  }
  if (topRank === null) throw new Error('Cannot determine top rank of pile')
  if (rank !== topRank) throw new Error('Thrown-in cards must match the top rank of the pile')

  const newDiscard = [...state.discardPile, ...cards]
  if (!checkFourOfAKind(newDiscard)) throw new Error('Throwing in these cards would not complete four of a kind')

  const idSet = new Set(cardIds)
  let newPlayer: ServerPlayerState = { ...player, hand: player.hand.filter((c) => !idSet.has(c.id)) }

  let newDrawPile = state.drawPile
  const drawn = drawToRefill(newPlayer, newDrawPile)
  newPlayer = drawn.player
  newDrawPile = drawn.drawPile

  const isFinished = newPlayer.hand.length === 0 && newPlayer.faceUp.length === 0 && newPlayer.faceDown.length === 0
  newPlayer = { ...newPlayer, isFinished }

  const newPlayers = [...state.players]
  newPlayers[playerIdx] = newPlayer

  const newFinished = [...state.finishedPlayerIds]
  if (isFinished && !newFinished.includes(playerId)) newFinished.push(playerId)

  let newState: ServerGameState = {
    ...state,
    players: newPlayers,
    drawPile: newDrawPile,
    discardPile: [],
    effectiveTop: null,
    constraint: 'none',
    finishedPlayerIds: newFinished,
    currentPlayerIndex: playerIdx,
  }

  if (isFinished) {
    let next = (playerIdx + 1) % newPlayers.length
    while (newPlayers[next].isFinished) next = (next + 1) % newPlayers.length
    newState = { ...newState, currentPlayerIndex: next }
  }

  logger.info('Throw-in: {playerName} threw {count}x{rank} [four-of-a-kind burn]', { playerName: player.name, count: cards.length, rank })
  return { state: newState, burned: true, faceDownUnplayable: false, playerFinished: isFinished, gameOver: false }
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
