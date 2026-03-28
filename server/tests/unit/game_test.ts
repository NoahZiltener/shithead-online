import { assertEquals, assertThrows } from '@std/assert'
import { configureSync, getConsoleSink, getLogger } from '@logtape/logtape'
import {
  canPlayCard,
  canPlayCards,
  checkFourOfAKind,
  createDeck,
  dealCards,
  getClientState,
  pickUpPile,
  playCards,
  setFaceUp,
  shuffle,
  type ServerGameState,
  type ServerPlayerState,
} from '../../src/game/index.ts'
import type { Card, PileConstraint, Rank } from '../../../shared/src/types.ts'

configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ['shithead-online'], sinks: ['console'], lowestLevel: 'debug' },
  ],
})

const logger = getLogger(['shithead-online', 'game-test'])

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCard(rank: Rank, id?: string): Card {
  return { id: id ?? `c${rank}`, suit: 'spades', rank }
}

function makeState(overrides: Partial<ServerGameState> = {}): ServerGameState {
  return {
    players: [],
    drawPile: [],
    discardPile: [],
    effectiveTop: null,
    constraint: 'none',
    currentPlayerIndex: 0,
    phase: 'playing',
    finishedPlayerIds: [],
    ...overrides,
  }
}

function makePlayer(id: string, overrides: Partial<ServerPlayerState> = {}): ServerPlayerState {
  return {
    id,
    name: id,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    hasSetFaceUp: true,
    ...overrides,
  }
}

// ── createDeck ─────────────────────────────────────────────────────────────

Deno.test('createDeck: single deck has 52 cards', () => {
  const deck = createDeck()
  logger.debug('createDeck single: {count} cards', { count: deck.length })
  assertEquals(deck.length, 52)
})

Deno.test('createDeck: double deck has 104 cards', () => {
  const doubleDeck = createDeck(true)
  logger.debug('createDeck double: {count} cards', { count: doubleDeck.length })
  assertEquals(doubleDeck.length, 104)
})

Deno.test('createDeck: all 13 ranks × 4 suits present', () => {
  const deck = createDeck()
  const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as Rank[]
  const suits = ['clubs', 'diamonds', 'hearts', 'spades'] as const
  logger.debug('checking {ranks} ranks × {suits} suits', { ranks: ranks.length, suits: suits.length })
  for (const rank of ranks) {
    for (const suit of suits) {
      const count = deck.filter((c) => c.rank === rank && c.suit === suit).length
      logger.debug('rank {rank} {suit}: {count}', { rank, suit, count })
      assertEquals(count, 1)
    }
  }
})

Deno.test('createDeck: all IDs are unique', () => {
  const deck = createDeck()
  const ids = new Set(deck.map((c) => c.id))
  logger.debug('unique IDs: {unique} / {total}', { unique: ids.size, total: deck.length })
  assertEquals(ids.size, 52)
})

// ── shuffle ────────────────────────────────────────────────────────────────

Deno.test('shuffle: returns same length', () => {
  const deck = createDeck()
  const shuffled = shuffle(deck)
  logger.debug('shuffle result length: {length}', { length: shuffled.length })
  assertEquals(shuffled.length, 52)
})

Deno.test('shuffle: does not mutate original', () => {
  const deck = createDeck()
  const first = deck[0]
  shuffle(deck)
  logger.debug('original first card unchanged: {id} rank={rank}', { id: first.id, rank: first.rank })
  assertEquals(deck[0], first)
})

// ── dealCards ──────────────────────────────────────────────────────────────

Deno.test('dealCards: throws with fewer than 2 players', () => {
  assertThrows(() => dealCards([{ id: 'p1', name: 'Alice' }]), Error, 'at least 2')
})

Deno.test('dealCards: each player gets 6 cards in hand and 3 face-down initially', () => {
  const state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  for (const p of state.players) {
    logger.debug('player {id}: hand={hand} faceUp={faceUp} faceDown={faceDown}', {
      id: p.id,
      hand: p.hand.length,
      faceUp: p.faceUp.length,
      faceDown: p.faceDown.length,
    })
    assertEquals(p.hand.length, 6)
    assertEquals(p.faceUp.length, 0)
    assertEquals(p.faceDown.length, 3)
  }
})

Deno.test('dealCards: draw pile is remainder after dealing', () => {
  const state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  logger.debug('draw pile after deal: {count} cards', { count: state.drawPile.length })
  assertEquals(state.drawPile.length, 52 - 18) // 52 - 2×9
})

Deno.test('dealCards: phase is setup', () => {
  const state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  logger.debug('initial phase: {phase}', { phase: state.phase })
  assertEquals(state.phase, 'setup')
})

Deno.test('dealCards: double deck leaves correct remainder', () => {
  const players = [0, 1, 2, 3, 4, 5].map((i) => ({ id: `p${i}`, name: `P${i}` }))
  const state = dealCards(players, true)
  logger.debug('double deck draw pile: {count} remaining (expected {expected})', { count: state.drawPile.length, expected: 104 - 6 * 9 })
  assertEquals(state.drawPile.length, 104 - 6 * 9)
})

// ── setFaceUp ──────────────────────────────────────────────────────────────

Deno.test('setFaceUp: splits 9 cards into 3+3+3', () => {
  let state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  const p1 = state.players[0]
  const faceUpIds = p1.hand.slice(0, 3).map((c) => c.id)
  logger.debug('choosing face-up cards: {ids}', { ids: faceUpIds.join(', ') })
  state = setFaceUp(state, 'p1', faceUpIds)
  const updated = state.players[0]
  logger.debug('after setFaceUp: hand={hand} faceUp={faceUp} faceDown={faceDown}', {
    hand: updated.hand.length,
    faceUp: updated.faceUp.length,
    faceDown: updated.faceDown.length,
  })
  assertEquals(updated.faceUp.length, 3)
  assertEquals(updated.faceDown.length, 3)
  assertEquals(updated.hand.length, 3)
  assertEquals(updated.hasSetFaceUp, true)
})

Deno.test('setFaceUp: chosen cards appear in faceUp', () => {
  let state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  const p1 = state.players[0]
  const chosen = p1.hand.slice(0, 3)
  const faceUpIds = chosen.map((c) => c.id)
  state = setFaceUp(state, 'p1', faceUpIds)
  for (const card of chosen) {
    const found = state.players[0].faceUp.some((c) => c.id === card.id)
    logger.debug('card {id} rank={rank} in faceUp: {found}', { id: card.id, rank: card.rank, found })
    assertEquals(found, true)
  }
})

Deno.test('setFaceUp: throws if not exactly 3 IDs', () => {
  const state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  assertThrows(() => setFaceUp(state, 'p1', ['a', 'b']), Error, 'exactly 3')
})

Deno.test('setFaceUp: throws if already set', () => {
  let state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  const ids = state.players[0].hand.slice(0, 3).map((c) => c.id)
  state = setFaceUp(state, 'p1', ids)
  assertThrows(() => setFaceUp(state, 'p1', ids), Error, 'Already')
})

Deno.test('setFaceUp: transitions to playing when all players ready', () => {
  let state = dealCards([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }])
  state = setFaceUp(state, 'p1', state.players[0].hand.slice(0, 3).map((c) => c.id))
  logger.debug('phase after p1 ready: {phase}', { phase: state.phase })
  assertEquals(state.phase, 'setup') // p2 not ready yet
  state = setFaceUp(state, 'p2', state.players[1].hand.slice(0, 3).map((c) => c.id))
  logger.debug('phase after p2 ready: {phase}', { phase: state.phase })
  assertEquals(state.phase, 'playing')
})

// ── canPlayCard ─────────────────────────────────────────────────────────────

Deno.test('canPlayCard: 2 can always be played', () => {
  const r1 = canPlayCard(makeCard(2), makeCard(14), 'none')
  const r2 = canPlayCard(makeCard(2), makeCard(14), 'after7')
  assertEquals(r1, true)
  assertEquals(r2, true)
})

Deno.test('canPlayCard: 3 can always be played', () => {
  const r1 = canPlayCard(makeCard(3), makeCard(14), 'none')
  const r2 = canPlayCard(makeCard(3), null, 'after7')
  assertEquals(r1, true)
  assertEquals(r2, true)
})

Deno.test('canPlayCard: 10 can always be played', () => {
  const r1 = canPlayCard(makeCard(10), makeCard(14), 'none')
  const r2 = canPlayCard(makeCard(10), makeCard(14), 'after7')
  assertEquals(r1, true)
  assertEquals(r2, true)
})

Deno.test('canPlayCard: normal card must be >= effectiveTop', () => {
  const r1 = canPlayCard(makeCard(9), makeCard(9), 'none')
  const r2 = canPlayCard(makeCard(9), makeCard(11), 'none')
  const r3 = canPlayCard(makeCard(14), makeCard(9), 'none')
  assertEquals(r1, true)
  assertEquals(r2, false)
  assertEquals(r3, true)
})

Deno.test('canPlayCard: any card on empty pile', () => {
  const r1 = canPlayCard(makeCard(4), null, 'none')
  const r2 = canPlayCard(makeCard(7), null, 'none')
  assertEquals(r1, true)
  assertEquals(r2, true)
})

Deno.test('canPlayCard: after2 — can play anything except 7', () => {
  const r1 = canPlayCard(makeCard(7), null, 'after2')
  const r2 = canPlayCard(makeCard(4), null, 'after2')
  const r3 = canPlayCard(makeCard(14), null, 'after2')
  const r4 = canPlayCard(makeCard(9), null, 'after2')
  assertEquals(r1, false)
  assertEquals(r2, true)
  assertEquals(r3, true)
  assertEquals(r4, true)
})

Deno.test('canPlayCard: after7 — must play 7 or lower', () => {
  const r1 = canPlayCard(makeCard(7), null, 'after7')
  const r2 = canPlayCard(makeCard(6), null, 'after7')
  const r3 = canPlayCard(makeCard(8), null, 'after7')
  const r4 = canPlayCard(makeCard(14), null, 'after7')
  assertEquals(r1, true)
  assertEquals(r2, true)
  assertEquals(r3, false)
  assertEquals(r4, false)
})

Deno.test('canPlayCard: 7 needs effectiveTop >= 7', () => {
  const r1 = canPlayCard(makeCard(7), makeCard(7), 'none')
  const r2 = canPlayCard(makeCard(7), makeCard(8), 'none')
  const r3 = canPlayCard(makeCard(7), makeCard(6), 'none')
  const r4 = canPlayCard(makeCard(7), null, 'none')
  assertEquals(r1, true)
  assertEquals(r2, true)
  assertEquals(r3, false)
  assertEquals(r4, true)
})

// ── canPlayCards ───────────────────────────────────────────────────────────

Deno.test('canPlayCards: empty array returns false', () => {
  const result = canPlayCards([], null, 'none')
  assertEquals(result, false)
})

Deno.test('canPlayCards: mixed ranks returns false', () => {
  const result = canPlayCards([makeCard(5, 'a'), makeCard(6, 'b')], null, 'none')
  assertEquals(result, false)
})

Deno.test('canPlayCards: same rank returns true when playable', () => {
  const result = canPlayCards([makeCard(9, 'a'), makeCard(9, 'b')], makeCard(8), 'none')
  assertEquals(result, true)
})

// ── checkFourOfAKind ───────────────────────────────────────────────────────

Deno.test('checkFourOfAKind: four same rank returns true', () => {
  const pile = [makeCard(5, 'a'), makeCard(5, 'b'), makeCard(5, 'c'), makeCard(5, 'd')]
  const result = checkFourOfAKind(pile)
  assertEquals(result, true)
})

Deno.test('checkFourOfAKind: three same rank returns false', () => {
  const pile = [makeCard(5, 'a'), makeCard(5, 'b'), makeCard(5, 'c')]
  const result = checkFourOfAKind(pile)
  assertEquals(result, false)
})

Deno.test('checkFourOfAKind: four same rank with 3s interspersed returns true', () => {
  const pile = [makeCard(9, 'a'), makeCard(3, 'x'), makeCard(9, 'b'), makeCard(9, 'c'), makeCard(9, 'd')]
  const result = checkFourOfAKind(pile)
  assertEquals(result, true)
})

Deno.test('checkFourOfAKind: different ranks break streak', () => {
  const pile = [makeCard(5, 'a'), makeCard(6, 'b'), makeCard(5, 'c'), makeCard(5, 'd')]
  const result = checkFourOfAKind(pile)
  assertEquals(result, false)
})

// ── playCards ──────────────────────────────────────────────────────────────

Deno.test('playCards: throws when not your turn', () => {
  const state = makeState({ players: [makePlayer('p1'), makePlayer('p2', { hand: [makeCard(5)] })], currentPlayerIndex: 0 })
  assertThrows(() => playCards(state, 'p2', ['c5']), Error, 'Not your turn')
})

Deno.test('playCards: throws when game not in playing phase', () => {
  const state = makeState({ phase: 'setup', players: [makePlayer('p1', { hand: [makeCard(5)] })] })
  assertThrows(() => playCards(state, 'p1', ['c5']), Error, 'playing phase')
})

Deno.test('playCards: normal card advances turn', () => {
  const card = makeCard(9, 'c9')
  // p1 has 2 cards so playing 1 does not finish them (avoiding immediate game-over in 2-player)
  const state = makeState({
    players: [makePlayer('p1', { hand: [card, makeCard(11, 'cJ')] }), makePlayer('p2', { hand: [makeCard(14, 'cA')] })],
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c9'])
  logger.debug('after play: nextPlayer={nextPlayer} pileSize={pileSize} burned={burned} gameOver={gameOver}', {
    nextPlayer: result.state.currentPlayerIndex,
    pileSize: result.state.discardPile.length,
    burned: result.burned,
    gameOver: result.gameOver,
  })
  assertEquals(result.state.currentPlayerIndex, 1)
  assertEquals(result.state.discardPile.length, 1)
  assertEquals(result.burned, false)
  assertEquals(result.gameOver, false)
})

Deno.test('playCards: 10 burns the pile and player goes again', () => {
  const ten = makeCard(10, 'c10')
  const king = makeCard(13, 'cK')
  const state = makeState({
    players: [makePlayer('p1', { hand: [ten] }), makePlayer('p2', { hand: [king] })],
    discardPile: [makeCard(9, 'c9')],
    effectiveTop: makeCard(9, 'c9'),
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c10'])
  logger.debug('10 played: burned={burned} pileSize={pileSize} currentPlayer={currentPlayer}', {
    burned: result.burned,
    pileSize: result.state.discardPile.length,
    currentPlayer: result.state.currentPlayerIndex,
  })
  assertEquals(result.burned, true)
  assertEquals(result.state.discardPile.length, 0)
  assertEquals(result.state.currentPlayerIndex, 0) // goes again
})

Deno.test('playCards: four of a kind burns pile and player goes again', () => {
  const state = makeState({
    players: [makePlayer('p1', { hand: [makeCard(7, 'c7d')] }), makePlayer('p2', { hand: [makeCard(8, 'c8')] })],
    discardPile: [makeCard(7, 'c7a'), makeCard(7, 'c7b'), makeCard(7, 'c7c')],
    effectiveTop: makeCard(7, 'c7a'),
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c7d'])
  logger.debug('4-of-a-kind: burned={burned} pileSize={pileSize} currentPlayer={currentPlayer}', {
    burned: result.burned,
    pileSize: result.state.discardPile.length,
    currentPlayer: result.state.currentPlayerIndex,
  })
  assertEquals(result.burned, true)
  assertEquals(result.state.discardPile.length, 0)
  assertEquals(result.state.currentPlayerIndex, 0)
})

Deno.test('playCards: 8 skips the next player', () => {
  const eight = makeCard(8, 'c8')
  const state = makeState({
    players: [makePlayer('p1', { hand: [eight] }), makePlayer('p2', { hand: [makeCard(9, 'c9')] }), makePlayer('p3', { hand: [makeCard(9, 'c9b')] })],
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c8'])
  // p2 should be skipped, p3 goes next
  logger.debug('8 played: skipped p2, currentPlayer={currentPlayer}', { currentPlayer: result.state.currentPlayerIndex })
  assertEquals(result.state.currentPlayerIndex, 2)
})

Deno.test('playCards: 3 is transparent (effectiveTop unchanged)', () => {
  const king = makeCard(13, 'cK')
  const three = makeCard(3, 'c3')
  const state = makeState({
    players: [makePlayer('p1', { hand: [three] }), makePlayer('p2', { hand: [makeCard(9, 'c9')] })],
    discardPile: [king],
    effectiveTop: king,
    constraint: 'none',
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c3'])
  // effectiveTop should still be King, not 3
  logger.debug('3 played: effectiveTop={rank} constraint={constraint}', {
    rank: result.state.effectiveTop?.rank,
    constraint: result.state.constraint,
  })
  assertEquals(result.state.effectiveTop?.rank, 13)
  assertEquals(result.state.constraint, 'none')
})

Deno.test('playCards: 2 sets after2 constraint', () => {
  const two = makeCard(2, 'c2')
  const state = makeState({
    players: [makePlayer('p1', { hand: [two] }), makePlayer('p2', { hand: [makeCard(9, 'c9')] })],
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c2'])
  logger.debug('2 played: constraint={constraint}', { constraint: result.state.constraint })
  assertEquals(result.state.constraint, 'after2')
})

Deno.test('playCards: 7 sets after7 constraint', () => {
  const seven = makeCard(7, 'c7')
  const state = makeState({
    players: [makePlayer('p1', { hand: [seven] }), makePlayer('p2', { hand: [makeCard(6, 'c6')] })],
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c7'])
  logger.debug('7 played: constraint={constraint}', { constraint: result.state.constraint })
  assertEquals(result.state.constraint, 'after7')
})

Deno.test('playCards: player finishes when all cards played', () => {
  const card = makeCard(9, 'c9')
  const state = makeState({
    players: [makePlayer('p1', { hand: [card] }), makePlayer('p2', { hand: [makeCard(9, 'c9b')] })],
    drawPile: [],
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c9'])
  logger.debug('player finished: {finished} isFinished={isFinished}', {
    finished: result.playerFinished,
    isFinished: result.state.players[0].isFinished,
  })
  assertEquals(result.playerFinished, true)
  assertEquals(result.state.players[0].isFinished, true)
})

Deno.test('playCards: draws up to 3 cards from draw pile after playing from hand', () => {
  const card = makeCard(9, 'c9')
  const drawCards = [makeCard(5, 'd5a'), makeCard(5, 'd5b'), makeCard(5, 'd5c')]
  const state = makeState({
    players: [makePlayer('p1', { hand: [card] }), makePlayer('p2', { hand: [makeCard(9, 'c9b')] })],
    drawPile: drawCards,
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c9'])
  logger.debug('after draw: hand={hand} drawPile={drawPile}', {
    hand: result.state.players[0].hand.length,
    drawPile: result.state.drawPile.length,
  })
  assertEquals(result.state.players[0].hand.length, 3)
  assertEquals(result.state.drawPile.length, 0)
})

Deno.test('playCards: cannot play unplayable card from hand', () => {
  const low = makeCard(4, 'c4')
  const state = makeState({
    players: [makePlayer('p1', { hand: [low] }), makePlayer('p2', { hand: [makeCard(9, 'c9')] })],
    discardPile: [makeCard(9, 'c9x')],
    effectiveTop: makeCard(9, 'c9x'),
    currentPlayerIndex: 0,
  })
  assertThrows(() => playCards(state, 'p1', ['c4']), Error)
})

Deno.test('playCards: face-down unplayable triggers forced pickup', () => {
  const lowCard = makeCard(4, 'cFD')
  const state = makeState({
    players: [
      makePlayer('p1', { hand: [], faceUp: [], faceDown: [lowCard] }),
      makePlayer('p2', { hand: [makeCard(9, 'c9')] }),
    ],
    discardPile: [makeCard(9, 'c9x')],
    effectiveTop: makeCard(9, 'c9x'),
    currentPlayerIndex: 0,
    drawPile: [],
  })
  const result = playCards(state, 'p1', ['fd_0'])
  logger.debug('face-down unplayable: faceDownUnplayable={faceDownUnplayable} handSize={handSize} pileSize={pileSize} nextPlayer={nextPlayer}', {
    faceDownUnplayable: result.faceDownUnplayable,
    handSize: result.state.players[0].hand.length,
    pileSize: result.state.discardPile.length,
    nextPlayer: result.state.currentPlayerIndex,
  })
  assertEquals(result.faceDownUnplayable, true)
  assertEquals(result.state.players[0].hand.length, 2) // pile (1) + face-down card (1)
  assertEquals(result.state.discardPile.length, 0)
  assertEquals(result.state.currentPlayerIndex, 1) // turn advanced
})

Deno.test('playCards: face-down playable card works normally', () => {
  const highCard = makeCard(14, 'cFDAce')
  const state = makeState({
    players: [
      makePlayer('p1', { hand: [], faceUp: [], faceDown: [highCard] }),
      makePlayer('p2', { hand: [makeCard(9, 'c9')] }),
    ],
    discardPile: [makeCard(9, 'c9x')],
    effectiveTop: makeCard(9, 'c9x'),
    currentPlayerIndex: 0,
    drawPile: [],
  })
  const result = playCards(state, 'p1', ['fd_0'])
  logger.debug('face-down playable: faceDownUnplayable={faceDownUnplayable} faceDownLeft={faceDownLeft}', {
    faceDownUnplayable: result.faceDownUnplayable,
    faceDownLeft: result.state.players[0].faceDown.length,
  })
  assertEquals(result.faceDownUnplayable, false)
  assertEquals(result.state.players[0].faceDown.length, 0)
})

Deno.test('playCards: game over when only one player remains (2-player)', () => {
  // In a 2-player game, when p1 plays their last card they finish.
  // p2 is now the only player with cards = shithead = game over immediately.
  const cardA = makeCard(9, 'cA9')
  const state = makeState({
    players: [
      makePlayer('p1', { hand: [cardA] }),
      makePlayer('p2', { hand: [makeCard(9, 'cB9')] }),
    ],
    drawPile: [],
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['cA9'])
  logger.debug('2-player game over: gameOver={gameOver} phase={phase} loser={loser}', {
    gameOver: result.gameOver,
    phase: result.state.phase,
    loser: result.state.loser,
  })
  assertEquals(result.gameOver, true)
  assertEquals(result.state.phase, 'finished')
  assertEquals(result.state.loser, 'p2')
})

Deno.test('playCards: game over triggers after second-to-last player finishes (3-player)', () => {
  // p1 finishes — 2 active players left, game continues
  // p2 finishes — 1 active player (p3) left = game over, p3 is shithead
  const state = makeState({
    players: [
      makePlayer('p1', { hand: [makeCard(9, 'cA9')] }),
      makePlayer('p2', { hand: [makeCard(9, 'cB9')] }),
      makePlayer('p3', { hand: [makeCard(5, 'cC5')] }),
    ],
    drawPile: [],
    currentPlayerIndex: 0,
  })
  const result1 = playCards(state, 'p1', ['cA9'])
  logger.debug('3-player round 1: gameOver={gameOver} playerFinished={playerFinished} nextPlayer={nextPlayer}', {
    gameOver: result1.gameOver,
    playerFinished: result1.playerFinished,
    nextPlayer: result1.state.currentPlayerIndex,
  })
  assertEquals(result1.gameOver, false)
  assertEquals(result1.playerFinished, true)
  assertEquals(result1.state.currentPlayerIndex, 1)

  const result2 = playCards(result1.state, 'p2', ['cB9'])
  logger.debug('3-player round 2: gameOver={gameOver} loser={loser}', {
    gameOver: result2.gameOver,
    loser: result2.state.loser,
  })
  assertEquals(result2.gameOver, true)
  assertEquals(result2.state.loser, 'p3')
})

Deno.test('playCards: multiple cards same rank played together', () => {
  const cards = [makeCard(9, 'c9a'), makeCard(9, 'c9b')]
  const state = makeState({
    players: [makePlayer('p1', { hand: cards }), makePlayer('p2', { hand: [makeCard(9, 'c9c')] })],
    currentPlayerIndex: 0,
  })
  const result = playCards(state, 'p1', ['c9a', 'c9b'])
  logger.debug('multi-play: pileSize={pileSize} handLeft={handLeft}', {
    pileSize: result.state.discardPile.length,
    handLeft: result.state.players[0].hand.length,
  })
  assertEquals(result.state.discardPile.length, 2)
  assertEquals(result.state.players[0].hand.length, 0)
})

// ── pickUpPile ─────────────────────────────────────────────────────────────

Deno.test('pickUpPile: adds pile to hand and advances turn', () => {
  const pileCards = [makeCard(9, 'c9a'), makeCard(11, 'cJa')]
  const state = makeState({
    players: [makePlayer('p1', { hand: [makeCard(4, 'c4')] }), makePlayer('p2', { hand: [makeCard(14, 'cA')] })],
    discardPile: pileCards,
    effectiveTop: makeCard(11, 'cJa'),
    currentPlayerIndex: 0,
  })
  const newState = pickUpPile(state, 'p1')
  logger.debug('pickUpPile: hand={hand} pileSize={pileSize} effectiveTop={effectiveTop} constraint={constraint} nextPlayer={nextPlayer}', {
    hand: newState.players[0].hand.length,
    pileSize: newState.discardPile.length,
    effectiveTop: newState.effectiveTop,
    constraint: newState.constraint,
    nextPlayer: newState.currentPlayerIndex,
  })
  assertEquals(newState.players[0].hand.length, 3) // 1 + 2 from pile
  assertEquals(newState.discardPile.length, 0)
  assertEquals(newState.effectiveTop, null)
  assertEquals(newState.constraint, 'none')
  assertEquals(newState.currentPlayerIndex, 1)
})

Deno.test('pickUpPile: throws on empty pile', () => {
  const state = makeState({
    players: [makePlayer('p1', { hand: [makeCard(4, 'c4')] }), makePlayer('p2', { hand: [makeCard(14, 'cA')] })],
    discardPile: [],
    currentPlayerIndex: 0,
  })
  assertThrows(() => pickUpPile(state, 'p1'), Error, 'empty')
})

Deno.test('pickUpPile: throws when not your turn', () => {
  const state = makeState({
    players: [makePlayer('p1', { hand: [makeCard(4, 'c4')] }), makePlayer('p2', { hand: [makeCard(14, 'cA')] })],
    discardPile: [makeCard(9, 'c9')],
    currentPlayerIndex: 0,
  })
  assertThrows(() => pickUpPile(state, 'p2'), Error, 'Not your turn')
})

// ── getClientState ─────────────────────────────────────────────────────────

Deno.test('getClientState: self sees own hand but not face-down cards', () => {
  const hand = [makeCard(9, 'c9'), makeCard(11, 'cJ')]
  const faceDown = [makeCard(14, 'cA'), makeCard(13, 'cK'), makeCard(12, 'cQ')]
  const state = makeState({
    players: [
      makePlayer('p1', { hand, faceDown }),
      makePlayer('p2', { hand: [makeCard(5, 'c5')] }),
    ],
    currentPlayerIndex: 0,
  })
  const view = getClientState(state, 'p1')
  logger.debug('self view: hand={hand} faceDownCount={faceDownCount} faceDownIds={faceDownIds}', {
    hand: view.self.hand.length,
    faceDownCount: view.self.faceDownCount,
    faceDownIds: view.self.faceDownIds.join(', '),
  })
  assertEquals(view.self.hand.length, 2)
  assertEquals(view.self.faceDownCount, 3)
  assertEquals(view.self.faceDownIds.length, 3)
  // faceDownIds should not reveal rank/suit
  for (const id of view.self.faceDownIds) {
    assertEquals(id.startsWith('fd_'), true)
  }
})

Deno.test('getClientState: opponent sees only handCount and faceUp', () => {
  const state = makeState({
    players: [
      makePlayer('p1', { hand: [makeCard(9, 'c9'), makeCard(11, 'cJ')], faceDown: [makeCard(14, 'cA')] }),
      makePlayer('p2', { hand: [makeCard(5, 'c5')] }),
    ],
    currentPlayerIndex: 0,
  })
  const view = getClientState(state, 'p2')
  logger.debug('opponent view: opponents={count} handCount={handCount} faceDownCount={faceDownCount}', {
    count: view.opponents.length,
    handCount: view.opponents[0]?.handCount,
    faceDownCount: view.opponents[0]?.faceDownCount,
  })
  assertEquals(view.opponents.length, 1)
  assertEquals(view.opponents[0].handCount, 2) // sees count, not cards
  assertEquals(view.opponents[0].faceDownCount, 1)
})

Deno.test('getClientState: currentPlayerId reflects currentPlayerIndex', () => {
  const state = makeState({
    players: [makePlayer('p1', { hand: [makeCard(9, 'c9')] }), makePlayer('p2', { hand: [makeCard(5, 'c5')] })],
    currentPlayerIndex: 1,
  })
  const view = getClientState(state, 'p1')
  logger.debug('currentPlayerId: {currentPlayerId}', { currentPlayerId: view.currentPlayerId })
  assertEquals(view.currentPlayerId, 'p2')
})
