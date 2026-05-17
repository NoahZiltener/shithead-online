import type { BotDifficulty, Card } from "../../../shared/src/types.ts";
import { canPlayCard } from "./rules.ts";
import type { ServerGameState, ServerPlayerState } from "./types.ts";

export type BotTurnAction =
  | { type: "set_face_up"; cardIds: string[] }
  | { type: "play_card"; cardIds: string[] }
  | { type: "pick_up_pile" };

type Rng = () => number;

function getCardSource(
  player: ServerPlayerState,
  drawPileEmpty: boolean,
): "hand" | "faceUp" | "faceDown" {
  if (player.hand.length > 0) return "hand";
  if (drawPileEmpty && player.faceUp.length > 0) return "faceUp";
  return "faceDown";
}

function groupByRank(cards: Card[]): Map<number, Card[]> {
  const grouped = new Map<number, Card[]>();
  for (const card of cards) {
    const group = grouped.get(card.rank);
    if (group) group.push(card);
    else grouped.set(card.rank, [card]);
  }
  return grouped;
}

function botCardScore(card: Card): number {
  if (card.rank === 10) return 100;
  if (card.rank === 2) return 90;
  if (card.rank === 8) return 80;
  if (card.rank === 3) return 70;
  if (card.rank === 7) return 60;
  return card.rank;
}

function pickFaceUpCards(
  hand: Card[],
  difficulty: BotDifficulty,
  rng: Rng,
): string[] {
  if (difficulty === "easy") {
    return [...hand]
      .sort(() => rng() - 0.5)
      .slice(0, 3)
      .map((c) => c.id);
  }
  // Medium/Hard: keep stronger cards in hand for early game, move weaker to face-up.
  return [...hand]
    .sort((a, b) => botCardScore(a) - botCardScore(b))
    .slice(0, 3)
    .map((c) => c.id);
}

function chooseKnownCardPlay(
  cards: Card[],
  state: ServerGameState,
  difficulty: BotDifficulty,
  rng: Rng,
): string[] | null {
  const playable = cards.filter((c) =>
    canPlayCard(c, state.effectiveTop, state.constraint)
  );
  if (playable.length === 0) return null;

  const grouped = [...groupByRank(playable).values()];
  if (difficulty === "easy") {
    const randomGroup = grouped[Math.floor(rng() * grouped.length)];
    return [randomGroup[0].id];
  }

  // Medium/Hard baseline: prefer lowest-impact legal rank; save strong specials where possible.
  grouped.sort((a, b) => botCardScore(a[0]) - botCardScore(b[0]));

  // Prefer burning with 10 if there are dangerous constraints.
  const tenGroup = grouped.find((g) => g[0].rank === 10);
  if (
    tenGroup &&
    (state.constraint !== "none" || (state.effectiveTop?.rank ?? 0) >= 12)
  ) {
    return tenGroup.map((c) => c.id);
  }

  // Prefer completing four-of-a-kind if possible.
  for (const group of grouped) {
    const rank = group[0].rank;
    let count = 0;
    for (let i = state.discardPile.length - 1; i >= 0; i--) {
      const card = state.discardPile[i];
      if (card.rank === 3) continue;
      if (card.rank === rank) count++;
      else break;
    }
    const need = Math.max(1, 4 - count);
    if (count >= 3 || group.length >= need) {
      return group.slice(0, need).map((c) => c.id);
    }
  }

  // Prefer shedding more cards at once to avoid very long bot-only chains.
  const bestScore = botCardScore(grouped[0][0]);
  const topCandidates = grouped.filter((g) => botCardScore(g[0]) === bestScore);
  const selected = topCandidates[Math.floor(rng() * topCandidates.length)];

  if (difficulty === "hard") {
    return selected.map((c) => c.id);
  }

  // Medium: usually shed all, but keep some variance to avoid deterministic loops.
  if (selected.length > 1 && rng() < 0.8) {
    return selected.map((c) => c.id);
  }
  return [selected[0].id];
}

export function chooseBotAction(
  state: ServerGameState,
  botId: string,
  difficulty: BotDifficulty,
  rng: Rng = Math.random,
): BotTurnAction {
  const player = state.players.find((p) => p.id === botId);
  if (!player) throw new Error("Bot player not found");

  if (state.phase === "setup") {
    if (player.hasSetFaceUp) throw new Error("Bot already set face-up cards");
    return {
      type: "set_face_up",
      cardIds: pickFaceUpCards(player.hand, difficulty, rng),
    };
  }

  if (state.phase !== "playing") {
    throw new Error("Bot can only act in setup/playing phases");
  }

  const drawPileEmpty = state.drawPile.length === 0;
  const source = getCardSource(player, drawPileEmpty);
  if (source === "faceDown") {
    return { type: "play_card", cardIds: ["fd_0"] };
  }

  const activeCards = source === "hand" ? player.hand : player.faceUp;
  const chosen = chooseKnownCardPlay(activeCards, state, difficulty, rng);
  if (!chosen) return { type: "pick_up_pile" };
  return { type: "play_card", cardIds: chosen };
}
