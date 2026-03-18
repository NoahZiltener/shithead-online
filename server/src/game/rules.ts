import type { Card, PileConstraint } from '../../../shared/src/types.ts'

/**
 * Basic card playability — 2, 3, and 10 are always playable.
 * All others must be >= the top card's rank.
 * 7 has the extra restriction: can only be played on 7 or higher.
 */
export function canPlayCard(card: Card, effectiveTop: Card | null, _constraint: PileConstraint): boolean {
  if (card.rank === 2 || card.rank === 3 || card.rank === 10) return true
  if (effectiveTop === null) return true
  if (card.rank === 7) return effectiveTop.rank >= 7
  return card.rank >= effectiveTop.rank
}

export function canPlayCards(cards: Card[], effectiveTop: Card | null, constraint: PileConstraint): boolean {
  if (cards.length === 0) return false
  const rank = cards[0].rank
  if (!cards.every((c) => c.rank === rank)) return false
  return canPlayCard(cards[0], effectiveTop, constraint)
}
