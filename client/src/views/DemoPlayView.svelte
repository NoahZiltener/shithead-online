<script lang="ts">
  import MobileGameBoard from '$lib/MobileGameBoard.svelte'
  import type { Card, ClientGameState, Rank, Suit } from '$shared/types.ts'

  let { onBack, onOpenGallery }: { onBack: () => void; onOpenGallery: () => void } = $props()

  const FACE_RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
  const c = (id: string, rank: Rank, suit: Suit): Card => ({ id, rank, suit })
  const cardIsPlayable = (gs: ClientGameState, card: Card): boolean => {
    if (gs.phase !== 'playing') return true
    const { rank } = card
    if (rank === 2 || rank === 3 || rank === 10) return true
    if (gs.constraint === 'after2') return rank !== 7
    if (gs.constraint === 'after7') return rank <= 7
    if (!gs.effectiveTop) return true
    if (rank === 7) return gs.effectiveTop.rank >= 7
    return rank >= gs.effectiveTop.rank
  }

  type Scenario = {
    id: string
    title: string
    note: string
    state: ClientGameState
    faceDownReveal: Record<string, Card>
  }

  const scenarios: Scenario[] = [
    {
      id: 'setup',
      title: 'Setup Phase',
      note: 'Prioritizes hand + setup action.',
      state: {
        phase: 'setup',
        currentPlayerId: 'p0',
        constraint: 'none',
        effectiveTop: null,
        drawPileCount: 44,
        discardPile: [],
        finishedPlayerIds: [],
        self: {
          id: 'p0', name: 'You', isFinished: false, hasSetFaceUp: false,
          hand: [c('h1', 3, 'clubs'), c('h2', 7, 'hearts'), c('h3', 10, 'spades'), c('h4', 12, 'diamonds'), c('h5', 5, 'clubs'), c('h6', 14, 'hearts')],
          faceUp: [],
          faceDownCount: 3,
          faceDownIds: ['fd_0', 'fd_1', 'fd_2'],
        },
        opponents: [
          { id: 'p1', name: 'Mia', handCount: 6, faceUp: [], faceDownCount: 3, isFinished: false },
          { id: 'p2', name: 'Alex', handCount: 6, faceUp: [], faceDownCount: 3, isFinished: false },
        ],
      },
      faceDownReveal: { fd_0: c('r0', 8, 'clubs'), fd_1: c('r1', 4, 'hearts'), fd_2: c('r2', 9, 'spades') },
    },
    {
      id: 'my-turn',
      title: 'My Turn (Crowded Hand)',
      note: 'Tests spread mode with many cards.',
      state: {
        phase: 'playing',
        currentPlayerId: 'p0',
        constraint: 'none',
        effectiveTop: c('dt0', 8, 'diamonds'),
        drawPileCount: 17,
        discardPile: [c('d1', 4, 'clubs'), c('d2', 8, 'diamonds')],
        finishedPlayerIds: [],
        self: {
          id: 'p0', name: 'You', isFinished: false, hasSetFaceUp: true,
          hand: [c('h1', 2, 'clubs'), c('h2', 3, 'hearts'), c('h3', 5, 'diamonds'), c('h4', 7, 'spades'), c('h5', 8, 'clubs'), c('h6', 9, 'hearts'), c('h7', 10, 'spades'), c('h8', 13, 'diamonds'), c('h9', 14, 'clubs')],
          faceUp: [c('u1', 6, 'hearts'), c('u2', 11, 'spades'), c('u3', 12, 'clubs')],
          faceDownCount: 3,
          faceDownIds: ['fd_0', 'fd_1', 'fd_2'],
        },
        opponents: [
          { id: 'p1', name: 'Mia', handCount: 5, faceUp: [c('o1', 4, 'spades')], faceDownCount: 3, isFinished: false },
          { id: 'p2', name: 'Alex', handCount: 2, faceUp: [c('o2', 10, 'hearts'), c('o3', 7, 'clubs')], faceDownCount: 3, isFinished: false },
        ],
      },
      faceDownReveal: { fd_0: c('r0', 8, 'clubs'), fd_1: c('r1', 4, 'hearts'), fd_2: c('r2', 9, 'spades') },
    },
    {
      id: 'opp-turn',
      title: 'Opponent Turn',
      note: 'Checks non-turn state and counts.',
      state: {
        phase: 'playing',
        currentPlayerId: 'p2',
        constraint: 'after7',
        effectiveTop: c('dt0', 7, 'spades'),
        drawPileCount: 10,
        discardPile: [c('d1', 9, 'clubs'), c('d2', 7, 'spades')],
        finishedPlayerIds: [],
        self: {
          id: 'p0', name: 'You', isFinished: false, hasSetFaceUp: true,
          hand: [c('h1', 6, 'diamonds'), c('h2', 8, 'spades'), c('h3', 11, 'clubs'), c('h4', 13, 'hearts')],
          faceUp: [c('u1', 2, 'hearts'), c('u2', 10, 'clubs'), c('u3', 14, 'spades')],
          faceDownCount: 3,
          faceDownIds: ['fd_0', 'fd_1', 'fd_2'],
        },
        opponents: [
          { id: 'p1', name: 'Mia', handCount: 1, faceUp: [c('o1', 4, 'spades'), c('o2', 12, 'diamonds')], faceDownCount: 2, isFinished: false },
          { id: 'p2', name: 'Alex', handCount: 3, faceUp: [c('o3', 5, 'hearts')], faceDownCount: 1, isFinished: false },
        ],
      },
      faceDownReveal: { fd_0: c('r0', 8, 'clubs'), fd_1: c('r1', 4, 'hearts'), fd_2: c('r2', 9, 'spades') },
    },
    {
      id: 'face-up-only',
      title: 'Face-up Stage',
      note: 'No hand cards: face-up row becomes primary.',
      state: {
        phase: 'playing',
        currentPlayerId: 'p0',
        constraint: 'none',
        effectiveTop: c('dt0', 5, 'clubs'),
        drawPileCount: 0,
        discardPile: [c('d1', 5, 'clubs')],
        finishedPlayerIds: [],
        self: {
          id: 'p0', name: 'You', isFinished: false, hasSetFaceUp: true,
          hand: [],
          faceUp: [c('u1', 2, 'hearts'), c('u2', 9, 'spades'), c('u3', 12, 'clubs')],
          faceDownCount: 3,
          faceDownIds: ['fd_0', 'fd_1', 'fd_2'],
        },
        opponents: [
          { id: 'p1', name: 'Mia', handCount: 0, faceUp: [c('o1', 11, 'spades')], faceDownCount: 2, isFinished: false },
          { id: 'p2', name: 'Alex', handCount: 2, faceUp: [c('o2', 3, 'hearts')], faceDownCount: 2, isFinished: false },
        ],
      },
      faceDownReveal: { fd_0: c('r0', 8, 'clubs'), fd_1: c('r1', 4, 'hearts'), fd_2: c('r2', 9, 'spades') },
    },
    {
      id: 'face-down-only',
      title: 'Face-down Stage',
      note: 'No hand and no face-up cards.',
      state: {
        phase: 'playing',
        currentPlayerId: 'p0',
        constraint: 'after2',
        effectiveTop: c('dt0', 2, 'hearts'),
        drawPileCount: 0,
        discardPile: [c('d1', 6, 'clubs'), c('d2', 2, 'hearts')],
        finishedPlayerIds: ['p1'],
        self: {
          id: 'p0', name: 'You', isFinished: false, hasSetFaceUp: true,
          hand: [],
          faceUp: [],
          faceDownCount: 2,
          faceDownIds: ['fd_0', 'fd_1'],
        },
        opponents: [
          { id: 'p1', name: 'Mia', handCount: 0, faceUp: [], faceDownCount: 0, isFinished: true },
          { id: 'p2', name: 'Alex', handCount: 1, faceUp: [], faceDownCount: 1, isFinished: false },
        ],
      },
      faceDownReveal: { fd_0: c('r0', 7, 'clubs'), fd_1: c('r1', 10, 'diamonds') },
    },
  ]

  let scenarioId = $state('setup')
  const scenario = $derived(scenarios.find(s => s.id === scenarioId) ?? scenarios[0])
  const gameState = $derived(scenario.state)
  const self = $derived(gameState.self)
  const phase = $derived(gameState.phase)
  const isMyTurn = $derived(gameState.currentPlayerId === 'p0')
  const activePile = $derived(
    self.hand.length > 0 ? 'hand' as const :
    self.faceUp.length > 0 ? 'faceUp' as const :
    'faceDown' as const
  )

  let selectedIds = $state(new Set<string>())
  let peekedFdId = $state<string | null>(null)
  let peekedCard = $state<Card | null>(null)
  let notice = $state('')

  $effect(() => {
    const _sid = scenarioId
    selectedIds = new Set()
    peekedFdId = null
    peekedCard = null
    notice = ''
  })

  const sortedHandCards = $derived(
    [...self.hand].sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : a.suit.localeCompare(b.suit))
  )

  const canPickUp = $derived(
    isMyTurn &&
    gameState.discardPile.length > 0 &&
    activePile !== 'faceDown' &&
    !((activePile === 'hand' ? self.hand : self.faceUp).some(c => cardIsPlayable(gameState, c)))
  )

  const throwInRank = $derived<Rank | null>(null)
  const throwInIds = $derived<string[]>([])

  function show(msg: string) {
    notice = msg
    setTimeout(() => { notice = '' }, 1200)
  }

  function toggleCard(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds = next
  }

  function toggleSetup(id: string) {
    if (self.hasSetFaceUp) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else if (next.size < 3) next.add(id)
    selectedIds = next
  }

  function togglePlay(card: Card) {
    if (!isMyTurn || !cardIsPlayable(gameState, card)) return
    toggleCard(card.id)
  }

  function playFaceDown(fdId: string) {
    const reveal = scenario.faceDownReveal[fdId]
    if (!reveal) return
    if (peekedFdId === fdId) {
      show(`Played ${FACE_RANKS[reveal.rank] ?? reveal.rank}${reveal.suit[0].toUpperCase()}`)
      peekedFdId = null
      peekedCard = null
      return
    }
    peekedFdId = fdId
    peekedCard = reveal
  }
</script>

<div class="demo-play-bg"></div>
<div class="demo-play-shell">
  <header class="demo-play-header">
    <button class="btn-back" onclick={onBack}>← Back</button>
    <div class="header-center">
      <div class="demo-title">Mobile Play Demo</div>
      <div class="demo-subtitle">{scenario.note}</div>
    </div>
    <button class="btn-back" onclick={onOpenGallery}>Component Gallery</button>
  </header>

  <div class="scenario-row">
    {#each scenarios as s}
      <button class="scenario-btn" class:active={scenarioId === s.id} onclick={() => { scenarioId = s.id }}>
        {s.title}
      </button>
    {/each}
  </div>

  {#if notice}
    <div class="notice">{notice}</div>
  {/if}

  <MobileGameBoard
    gameState={gameState}
    playerId={'p0'}
    disconnectedIds={new Set<string>()}
    peekedFdId={peekedFdId}
    peekedCard={peekedCard}
    error={null}
    selectedIds={selectedIds}
    sortedHandCards={sortedHandCards}
    canPickUp={canPickUp}
    throwInRank={throwInRank}
    throwInIds={throwInIds}
    onToggleSetup={toggleSetup}
    onTogglePlay={togglePlay}
    onPlayFaceDown={playFaceDown}
    onConfirmSetup={() => show(`Confirm setup (${selectedIds.size}/3)`)}
    onPlaySelected={() => show(`Play ${selectedIds.size} selected`)}
    onThrowIn={() => show('Throw in')}
    onPickUpPile={() => show('Pick up pile')}
    onDismissError={() => {}}
    onLeave={() => show('Leave game')}
    cardIsPlayable={(card) => cardIsPlayable(gameState, card)}
  />
</div>

<style>
  .demo-play-bg {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse 120% 60% at 50% 50%, var(--felt) 0%, #0e1a13 55%, var(--bg) 100%);
    z-index: 0;
  }
  .demo-play-shell {
    position: relative;
    z-index: 1;
    height: 100vh;
    overflow: hidden;
  }
  .demo-play-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem;
    align-items: center;
    padding: calc(0.4rem + var(--safe-area-top)) 0.5rem 0.45rem;
    background: rgba(14,14,24,0.9);
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .header-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }
  .demo-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.15rem;
    color: var(--cream);
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .demo-subtitle {
    font-size: 0.72rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .btn-back {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    color: var(--text);
    font-size: 0.72rem;
    min-height: 34px;
    padding: 0.25rem 0.55rem;
  }
  .scenario-row {
    position: fixed;
    top: calc(3.2rem + var(--safe-area-top));
    left: 0;
    right: 0;
    z-index: 19;
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    padding: 0.45rem 0.5rem;
    background: rgba(14,14,24,0.85);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    -webkit-overflow-scrolling: touch;
  }
  .scenario-btn {
    flex-shrink: 0;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 999px;
    color: #ddd;
    font-size: 0.72rem;
    min-height: 30px;
    padding: 0.2rem 0.6rem;
  }
  .scenario-btn.active {
    border-color: rgba(247,37,133,0.6);
    color: #ff9bc8;
  }
  .notice {
    position: fixed;
    top: calc(5.75rem + var(--safe-area-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 999px;
    padding: 0.25rem 0.65rem;
    font-size: 0.72rem;
  }
  :global(.demo-play-shell .mobile-board) {
    padding-top: calc(7.4rem + var(--safe-area-top));
  }
</style>
