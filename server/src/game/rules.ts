import type { Card, PileConstraint, Rank } from '../../../shared/src/types.ts'

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
