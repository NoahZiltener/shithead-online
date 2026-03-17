import { getLogger } from '@logtape/logtape'
import type { Card, ClientGameState, GamePhase, OpponentView, PileConstraint, Rank, SelfView, Suit } from '../../shared/src/types.ts'

const logger = getLogger(['shithead-online', 'game'])

// ── Server-only state (never sent raw to clients) ──────────────────────────

export interface ServerPlayerState {
  id: string
  name: string
  hand: Card[]
  faceUp: Card[]
  faceDown: Card[]
  isFinished: boolean
  hasSetFaceUp: boolean
}

export interface ServerGameState {
  players: ServerPlayerState[] // fixed turn order
  drawPile: Card[]
  discardPile: Card[]
  effectiveTop: Card | null // last non-3 card on pile; null if pile empty or burned
  constraint: PileConstraint
  currentPlayerIndex: number
  phase: GamePhase
  finishedPlayerIds: string[]
  loser?: string
}

export interface PlayResult {
  state: ServerGameState
  burned: boolean
  faceDownCard?: Card // revealed face-down card (if applicable)
  faceDownUnplayable?: boolean // true if face-down card couldn't be played
  playerFinished: boolean
  gameOver: boolean
}

// ── Deck ───────────────────────────────────────────────────────────────────

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export function createDeck(double = false): Card[] {
  const decks = double ? 2 : 1
  const cards: Card[] = []
  let idx = 0
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${suit[0]}${rank}_${idx++}`, suit, rank })
      }
    }
  }
  logger.debug('Deck created ({cardCount} cards, double={double})', { cardCount: cards.length, double })
  return cards
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  logger.debug('Shuffled {count} items', { count: result.length })
  return result
}

// ── Deal ───────────────────────────────────────────────────────────────────

export function dealCards(
  players: Array<{ id: string; name: string }>,
  double = false,
): ServerGameState {
  if (players.length < 2) throw new Error('Need at least 2 players')
  const deck = shuffle(createDeck(double))
  let cursor = 0

  const playerStates: ServerPlayerState[] = players.map((p) => {
    const nine = deck.slice(cursor, cursor + 9)
    cursor += 9
    // First 3 cards go face-down immediately (hidden from player); remaining 6 are the hand
    return { id: p.id, name: p.name, hand: nine.slice(3), faceUp: [], faceDown: nine.slice(0, 3), isFinished: false, hasSetFaceUp: false }
  })

  const gs: ServerGameState = {
    players: playerStates,
    drawPile: deck.slice(cursor),
    discardPile: [],
    effectiveTop: null,
    constraint: 'none',
    currentPlayerIndex: 0,
    phase: 'setup',
    finishedPlayerIds: [],
  }
  logger.debug('Cards dealt to {playerCount} players (double={double})', { playerCount: players.length, double })
  return gs
}

// ── Setup phase: choose face-up cards ──────────────────────────────────────

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

// ── Play rules ─────────────────────────────────────────────────────────────

/**
 * 2 and 3 can be played on any card.
 * 10 can be played on any card (burns the pile).
 * 7 can only be played on 7 or higher.
 * After 2: anything except 7.
 * After 7: must play 7 or lower (2 and 3 still always playable).
 * Normal: must play >= effectiveTop rank.
 */
export function canPlayCard(card: Card, effectiveTop: Card | null, constraint: PileConstraint): boolean {
  if (card.rank === 2 || card.rank === 3 || card.rank === 10) return true

  switch (constraint) {
    case 'after2':
      return card.rank !== 7
    case 'after7':
      return card.rank <= 7
    default:
      if (effectiveTop === null) return true
      // 7 has an additional restriction: must play ON 7 or higher
      if (card.rank === 7) return effectiveTop.rank >= 7
      return card.rank >= effectiveTop.rank
  }
}

export function canPlayCards(cards: Card[], effectiveTop: Card | null, constraint: PileConstraint): boolean {
  if (cards.length === 0) return false
  const rank = cards[0].rank
  if (!cards.every((c) => c.rank === rank)) return false
  return canPlayCard(cards[0], effectiveTop, constraint)
}

// Checks if the top consecutive same-rank cards (skipping 3s) number >= 4
export function checkFourOfAKind(pile: Card[]): boolean {
  if (pile.length < 4) return false
  // Find effective top rank (skip trailing 3s)
  let topRank: Rank | null = null
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank !== 3) { topRank = pile[i].rank; break }
  }
  if (topRank === null) return false

  let count = 0
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank === 3) continue // transparent
    if (pile[i].rank === topRank) count++
    else break
  }
  return count >= 4
}

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
  // Skip finished players
  while (state.players[next].isFinished) next = (next + 1) % n

  if (skipNext) {
    // Notify skipped player (caller handles events), move past them
    next = (next + 1) % n
    while (state.players[next].isFinished) next = (next + 1) % n
  }

  return { ...state, currentPlayerIndex: next }
}

// ── Play cards ─────────────────────────────────────────────────────────────

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

  let cards: Card[]
  let newPlayer: ServerPlayerState
  let faceDownCard: Card | undefined

  if (source === 'faceDown') {
    if (cardIds.length !== 1) throw new Error('Can only play one face-down card at a time')
    const fdIdx = parseFaceDownId(cardIds[0])
    if (fdIdx < 0 || fdIdx >= player.faceDown.length) throw new Error('Invalid face-down card index')
    const actualCard = player.faceDown[fdIdx]
    faceDownCard = actualCard
    cards = [actualCard]
    const newFaceDown = player.faceDown.filter((_, i) => i !== fdIdx)

    if (!canPlayCard(actualCard, state.effectiveTop, state.constraint)) {
      // Unplayable face-down card: pick up pile + card, turn ends
      logger.debug('Player {playerId} revealed unplayable face-down card {cardId}, picking up pile', { playerId, cardId: actualCard.id })
      const pickedUp = [...state.discardPile, actualCard]
      newPlayer = { ...player, hand: [...player.hand, ...pickedUp], faceDown: newFaceDown }
      const newPlayers = [...state.players]
      newPlayers[playerIdx] = newPlayer
      let newState: ServerGameState = { ...state, players: newPlayers, discardPile: [], effectiveTop: null, constraint: 'none' }
      newState = advanceTurn(newState, false, false)
      return { state: newState, burned: false, faceDownCard: actualCard, faceDownUnplayable: true, playerFinished: false, gameOver: false }
    }

    newPlayer = { ...player, faceDown: newFaceDown }
  } else {
    // Hand or face-up: player specifies known card IDs
    const pool = source === 'hand' ? player.hand : player.faceUp
    const cardMap = new Map(pool.map((c) => [c.id, c]))
    cards = cardIds.map((id) => {
      const c = cardMap.get(id)
      if (!c) throw new Error(`Card "${id}" not found in ${source}`)
      return c
    })

    const rank = cards[0].rank
    if (!cards.every((c) => c.rank === rank)) { logger.warn('Player {playerId} tried to play cards of mixed ranks', { playerId }); throw new Error('All played cards must be the same rank') }
    if (!canPlayCard(cards[0], state.effectiveTop, state.constraint)) { logger.warn('Player {playerId} tried to play invalid card (rank={rank}, constraint={constraint})', { playerId, rank, constraint: state.constraint }); throw new Error('Cannot play this card on the current pile') }

    const idSet = new Set(cardIds)
    if (source === 'hand') {
      newPlayer = { ...player, hand: player.hand.filter((c) => !idSet.has(c.id)) }
    } else {
      newPlayer = { ...player, faceUp: player.faceUp.filter((c) => !idSet.has(c.id)) }
    }
  }

  // Add to discard pile
  const newDiscard = [...state.discardPile, ...cards]
  const burnByTen = cards[0].rank === 10
  const burnByFour = !burnByTen && checkFourOfAKind(newDiscard)
  const burned = burnByTen || burnByFour

  // Update pile tracking
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

  // Draw phase (only when playing from hand and draw pile has cards)
  let finalPlayer = newPlayer
  let newDrawPile = state.drawPile
  if (source === 'hand') {
    const before = finalPlayer.hand.length
    while (finalPlayer.hand.length < 3 && newDrawPile.length > 0) {
      finalPlayer = { ...finalPlayer, hand: [...finalPlayer.hand, newDrawPile[0]] }
      newDrawPile = newDrawPile.slice(1)
    }
    const drawn = finalPlayer.hand.length - before
    if (drawn > 0) logger.debug('Player {playerId} drew {drawn} card(s) ({drawPileRemaining} left in draw pile)', { playerId, drawn, drawPileRemaining: newDrawPile.length })
  }

  // Check if player finished
  const isFinished =
    finalPlayer.hand.length === 0 && finalPlayer.faceUp.length === 0 && finalPlayer.faceDown.length === 0
  finalPlayer = { ...finalPlayer, isFinished }

  const newPlayers = [...state.players]
  newPlayers[playerIdx] = finalPlayer

  const newFinished = [...state.finishedPlayerIds]
  if (isFinished && !newFinished.includes(playerId)) newFinished.push(playerId)

  // Skip only applies if pile wasn't burned (if burned, player goes again)
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
    const loser = activePlayers.length === 1 ? activePlayers[0].id : undefined
    logger.info('Game over in round ending for player {playerId}, loser={loser}', { playerId, loser })
    newState = { ...newState, phase: 'finished', loser }
    return { state: newState, burned, faceDownCard, faceDownUnplayable: false, playerFinished: isFinished, gameOver: true }
  }

  if (isFinished) logger.info('Player {playerId} finished the game', { playerId })
  if (burnByTen) logger.debug('Pile burned by player {playerId} (rank=10)', { playerId })
  if (burnByFour) logger.debug('Pile burned by player {playerId} (four of a kind, rank={rank})', { playerId, rank: cards[0].rank })
  if (skipNext) logger.debug('Player {playerId} played an 8, next player\'s turn is skipped', { playerId })

  newState = advanceTurn(newState, playAgain, skipNext)
  logger.debug('Player {playerId} played {count} card(s) from {source} (rank={rank})', { playerId, count: cards.length, source, rank: cards[0].rank })
  return { state: newState, burned, faceDownCard, faceDownUnplayable: false, playerFinished: isFinished, gameOver: false }
}

// ── Pick up pile ───────────────────────────────────────────────────────────

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

  logger.debug('Player {playerId} picked up pile ({pileSize} cards)', { playerId, pileSize: state.discardPile.length })
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
  return newState
}

// ── Client view ────────────────────────────────────────────────────────────

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

// ── Utilities ──────────────────────────────────────────────────────────────

function parseFaceDownId(id: string): number {
  const match = id.match(/^fd_(\d+)$/)
  if (!match) return -1
  return parseInt(match[1], 10)
}
