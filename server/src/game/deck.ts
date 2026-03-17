import { getLogger } from '@logtape/logtape'
import type { Card, Rank, Suit } from '../../../shared/src/types.ts'
import type { ServerGameState, ServerPlayerState } from './types.ts'

const logger = getLogger(['shithead-online', 'game'])

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

export function dealCards(
  players: Array<{ id: string; name: string }>,
  double = false,
): ServerGameState {
  if (players.length < 2) { logger.error('dealCards: not enough players ({count})', { count: players.length }); throw new Error('Need at least 2 players') }
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
