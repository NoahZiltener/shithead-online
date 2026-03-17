import { getLogger } from '@logtape/logtape'
import type { Card, PileConstraint } from '../../../shared/src/types.ts'
import { canPlayCard, checkFourOfAKind } from './rules.ts'
import type { PlayResult, ServerGameState, ServerPlayerState } from './types.ts'

const logger = getLogger(['shithead-online', 'game'])

// ── Turn helpers ───────────────────────────────────────────────────────────

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

// ── Private play helpers ────────────────────────────────────────────────────

type FaceDownResolution =
  | { kind: 'playable'; cards: Card[]; newPlayer: ServerPlayerState; faceDownCard: Card }
  | { kind: 'unplayable'; result: PlayResult }

function parseFaceDownId(id: string): number {
  const match = id.match(/^fd_(\d+)$/)
  if (!match) return -1
  return parseInt(match[1], 10)
}

/** Resolves a face-down play attempt. Returns an early result if the card is unplayable. */
function resolveFaceDownPlay(
  state: ServerGameState,
  player: ServerPlayerState,
  playerIdx: number,
  cardIds: string[],
): FaceDownResolution {
  if (cardIds.length !== 1) { logger.warn('Player {playerId} tried to play {count} face-down cards at once', { playerId: player.id, count: cardIds.length }); throw new Error('Can only play one face-down card at a time') }
  const fdIdx = parseFaceDownId(cardIds[0])
  if (fdIdx < 0 || fdIdx >= player.faceDown.length) { logger.warn('Player {playerId} sent invalid face-down card index {fdIdx} (has {count})', { playerId: player.id, fdIdx, count: player.faceDown.length }); throw new Error('Invalid face-down card index') }

  const actualCard = player.faceDown[fdIdx]
  const newFaceDown = player.faceDown.filter((_, i) => i !== fdIdx)

  if (!canPlayCard(actualCard, state.effectiveTop, state.constraint)) {
    const pickedUp = [...state.discardPile, actualCard]
    const newPlayer = { ...player, hand: [...player.hand, ...pickedUp], faceDown: newFaceDown }
    const newPlayers = [...state.players]
    newPlayers[playerIdx] = newPlayer
    let newState: ServerGameState = { ...state, players: newPlayers, discardPile: [], effectiveTop: null, constraint: 'none' }
    newState = advanceTurn(newState, false, false)
    const nextPlayer = newState.players[newState.currentPlayerIndex]
    logger.info('Turn: {playerName} flipped unplayable face-down {rank} — picked up pile ({pileSize} cards) → next: {nextPlayerName}', { playerName: player.name, rank: actualCard.rank, pileSize: pickedUp.length, nextPlayerName: nextPlayer.name })
    return { kind: 'unplayable', result: { state: newState, burned: false, faceDownCard: actualCard, faceDownUnplayable: true, playerFinished: false, gameOver: false } }
  }

  return { kind: 'playable', cards: [actualCard], newPlayer: { ...player, faceDown: newFaceDown }, faceDownCard: actualCard }
}

/** Validates and extracts cards played from hand or face-up pile. */
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
    if (!c) { logger.warn('Player {playerId} played unknown card {cardId} from {source}', { playerId: player.id, cardId: id, source }); throw new Error(`Card "${id}" not found in ${source}`) }
    return c
  })

  const rank = cards[0].rank
  if (!cards.every((c) => c.rank === rank)) { logger.warn('Player {playerId} tried to play cards of mixed ranks', { playerId: player.id }); throw new Error('All played cards must be the same rank') }
  if (!canPlayCard(cards[0], state.effectiveTop, state.constraint)) { logger.warn('Player {playerId} tried to play invalid card (rank={rank}, constraint={constraint})', { playerId: player.id, rank, constraint: state.constraint }); throw new Error('Cannot play this card on the current pile') }

  const idSet = new Set(cardIds)
  const newPlayer = source === 'hand'
    ? { ...player, hand: player.hand.filter((c) => !idSet.has(c.id)) }
    : { ...player, faceUp: player.faceUp.filter((c) => !idSet.has(c.id)) }

  return { cards, newPlayer }
}

type PileUpdate = {
  newDiscard: Card[]
  burned: boolean
  burnedByTen: boolean
  burnedByFour: boolean
  newEffectiveTop: Card | null
  newConstraint: PileConstraint
}

/** Computes the new pile state after playing cards. */
function computePileUpdate(state: ServerGameState, cards: Card[]): PileUpdate {
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
    // 3 is transparent — keep previous effectiveTop and constraint
    newEffectiveTop = cards[cards.length - 1]
    newConstraint = cards[0].rank === 2 ? 'after2' : cards[0].rank === 7 ? 'after7' : 'none'
  }

  return { newDiscard, burned, burnedByTen, burnedByFour, newEffectiveTop, newConstraint }
}

/** Draws cards from the pile until the player has 3 or the draw pile is empty. */
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

// ── Public play functions ──────────────────────────────────────────────────

export function playCards(state: ServerGameState, playerId: string, cardIds: string[]): PlayResult {
  if (state.phase !== 'playing') { logger.warn('playCards called outside playing phase by {playerId}', { playerId }); throw new Error('Game not in playing phase') }
  if (cardIds.length === 0) { logger.warn('Player {playerId} sent empty card list', { playerId }); throw new Error('Must play at least one card') }

  const playerIdx = state.currentPlayerIndex
  const player = state.players[playerIdx]
  if (player.id !== playerId) { logger.warn('Out-of-turn play attempt by {playerId} (current: {currentPlayerId})', { playerId, currentPlayerId: player.id }); throw new Error('Not your turn') }

  const drawPileEmpty = state.drawPile.length === 0
  const source = getCardSource(player, drawPileEmpty)

  if (source === 'faceUp' && player.hand.length === 0) logger.debug('Player {playerId} is now playing from face-up cards', { playerId })
  if (source === 'faceDown') logger.debug('Player {playerId} is now playing from face-down cards', { playerId })

  // Resolve which cards are being played and the updated player state
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

  // Update pile state
  const { newDiscard, burned, burnedByTen, burnedByFour, newEffectiveTop, newConstraint } = computePileUpdate(state, cards)

  // Draw up to 3 (only when playing from hand)
  let finalPlayer = newPlayer
  let newDrawPile = state.drawPile
  if (source === 'hand') {
    const before = finalPlayer.hand.length
    const drawn = drawToRefill(finalPlayer, newDrawPile)
    finalPlayer = drawn.player
    newDrawPile = drawn.drawPile
    const drawnCount = finalPlayer.hand.length - before
    if (drawnCount > 0) logger.debug('Player {playerId} drew {drawn} card(s) ({drawPileRemaining} left in draw pile)', { playerId, drawn: drawnCount, drawPileRemaining: newDrawPile.length })
  }

  // Check if player finished
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

  // Check game over: <= 1 active player
  const activePlayers = newPlayers.filter((p) => !p.isFinished)
  if (activePlayers.length <= 1) {
    const loserPlayer = activePlayers.length === 1 ? activePlayers[0] : undefined
    logger.info('Game over — loser: {loserName} ({loserId})', { loserName: loserPlayer?.name ?? 'none', loserId: loserPlayer?.id ?? 'none' })
    newState = { ...newState, phase: 'finished', loser: loserPlayer?.id }
    return { state: newState, burned, faceDownCard, faceDownUnplayable: false, playerFinished: isFinished, gameOver: true }
  }

  newState = advanceTurn(newState, playAgain, skipNext)

  const nextPlayer = newState.players[newState.currentPlayerIndex]
  const effect = burned ? (burnedByFour ? 'four-of-a-kind burn' : 'burned by 10') : skipNext ? 'skip next' : playAgain ? 'play again' : 'normal'
  logger.info(
    'Turn: {playerName} played {count}x{rank} from {source} [{effect}] → next: {nextPlayerName}',
    { playerName: player.name, count: cards.length, rank: cards[0].rank, source, effect, nextPlayerName: isFinished ? '(finished)' : nextPlayer.name },
  )
  if (isFinished) logger.info('Player {playerName} ({playerId}) has finished the game', { playerName: player.name, playerId })
  return { state: newState, burned, faceDownCard, faceDownUnplayable: false, playerFinished: isFinished, gameOver: false }
}

export function pickUpPile(state: ServerGameState, playerId: string): ServerGameState {
  if (state.phase !== 'playing') { logger.warn('pickUpPile called outside playing phase by {playerId}', { playerId }); throw new Error('Game not in playing phase') }
  const playerIdx = state.currentPlayerIndex
  const player = state.players[playerIdx]
  if (player.id !== playerId) { logger.warn('Out-of-turn pick-up attempt by {playerId} (current: {currentPlayerId})', { playerId, currentPlayerId: player.id }); throw new Error('Not your turn') }
  if (state.discardPile.length === 0) { logger.warn('Player {playerId} tried to pick up empty pile', { playerId }); throw new Error('Discard pile is empty') }

  // Can only pick up when in hand or face-up phase (face-down handled by playCards)
  const drawPileEmpty = state.drawPile.length === 0
  const source = getCardSource(player, drawPileEmpty)
  if (source === 'faceDown') { logger.warn('Player {playerId} tried to pick up pile during face-down phase', { playerId }); throw new Error('In face-down phase: play a card instead') }

  const newPlayer = { ...player, hand: [...player.hand, ...state.discardPile] }
  const newPlayers = [...state.players]
  newPlayers[playerIdx] = newPlayer

  let newState: ServerGameState = {
    ...state,
    players: newPlayers,
    discardPile: [],
    effectiveTop: null,
    constraint: 'none',
  }
  newState = advanceTurn(newState, false, false)
  const nextPlayer = newState.players[newState.currentPlayerIndex]
  logger.info('Turn: {playerName} picked up pile ({pileSize} cards) → next: {nextPlayerName}', { playerName: player.name, pileSize: state.discardPile.length, nextPlayerName: nextPlayer.name })
  return newState
}
