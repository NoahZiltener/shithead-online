<script lang="ts">
  import type { Card, ClientGameState, Rank, Suit } from '$shared/types.ts'

  let {
    gameState,
    playerId,
    disconnectedIds,
    peekedFdId,
    peekedCard,
    error,
    selectedIds,
    sortedHandCards,
    canPickUp,
    throwInRank,
    throwInIds,
    onToggleSetup,
    onTogglePlay,
    onPlayFaceDown,
    onConfirmSetup,
    onPlaySelected,
    onThrowIn,
    onPickUpPile,
    onDismissError,
    onLeave,
    cardIsPlayable,
  }: {
    gameState: ClientGameState
    playerId: string | null
    disconnectedIds: Set<string>
    peekedFdId: string | null
    peekedCard: Card | null
    error: string | null
    selectedIds: Set<string>
    sortedHandCards: Card[]
    canPickUp: boolean
    throwInRank: Rank | null
    throwInIds: string[]
    onToggleSetup: (id: string) => void
    onTogglePlay: (card: Card) => void
    onPlayFaceDown: (id: string) => void
    onConfirmSetup: () => void
    onPlaySelected: () => void
    onThrowIn: () => void
    onPickUpPile: () => void
    onDismissError: () => void
    onLeave: () => void
    cardIsPlayable: (card: Card) => boolean
  } = $props()

  const FACE_RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
  function rankLabel(r: Rank): string { return FACE_RANKS[r] ?? String(r) }
  function suitSymbol(s: Suit): string {
    return { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }[s]
  }
  function isRed(s: Suit): boolean { return s === 'hearts' || s === 'diamonds' }
  function isSpecial(r: Rank): boolean { return ([2, 3, 7, 8, 10] as Rank[]).includes(r) }

  const self = $derived(gameState.self)
  const phase = $derived(gameState.phase)
  const isMyTurn = $derived(gameState.currentPlayerId === playerId)
  const activePile = $derived(
    self.hand.length > 0 ? 'hand' as const :
    self.faceUp.length > 0 ? 'faceUp' as const :
    'faceDown' as const
  )
  const constraintLabel = $derived(
    gameState.constraint === 'after2' ? 'No 7s' :
    gameState.constraint === 'after7' ? '≤ 7 only' : 'None'
  )
  const turnLabel = $derived(
    phase === 'setup' ? (self.hasSetFaceUp ? 'Waiting for others…' : 'Pick 3 face-up cards') :
    phase === 'finished' ? 'Game Over' :
    isMyTurn ? 'Your Turn' :
    (gameState.opponents.find(p => p.id === gameState.currentPlayerId)?.name ?? '?') + "'s Turn"
  )
  const discardTop3 = $derived(gameState.discardPile.slice(-3))
  const topCardCount = $derived.by(() => {
    const pile = gameState.discardPile
    if (pile.length === 0) return 0
    const topRank = pile[pile.length - 1].rank
    let count = 0
    for (let i = pile.length - 1; i >= 0 && pile[i].rank === topRank; i--) count++
    return count
  })

  let showOpponents = $state(false)
  let showInfo = $state(false)
  let previewOpponentId = $state<string | null>(null)
  let showSelfStacks = $state(false)
  const previewOpponent = $derived(
    previewOpponentId ? gameState.opponents.find((o) => o.id === previewOpponentId) ?? null : null
  )
  const showFaceUpRow = $derived(phase === 'setup' || (self.hand.length === 0 && self.faceUp.length > 0))
  const showFaceDownRow = $derived(self.hand.length === 0 && self.faceUp.length === 0)
  const hasHiddenSelfStacks = $derived(
    (self.faceUp.length > 0 && !showFaceUpRow) || (self.faceDownIds.length > 0 && !showFaceDownRow)
  )
</script>

<div
  class="mobile-board"
  class:playing-hand={phase === 'playing' && self.hand.length > 0}
  class:playing-faceup={phase === 'playing' && activePile === 'faceUp'}
  class:playing-facedown={phase === 'playing' && activePile === 'faceDown'}
>
  <div class="top-strip">
    <div class="turn-pill">{turnLabel}</div>
    <div class="count-pill">Draw {gameState.drawPileCount}</div>
    <div class="count-pill">Discard {gameState.discardPile.length}</div>
  </div>

  <div class="opponent-summary-row">
    {#each gameState.opponents as opp}
      <button class="opp-chip" onclick={() => { previewOpponentId = opp.id }}>
        {opp.name} · {opp.handCount}
        {#if gameState.currentPlayerId === opp.id && phase === 'playing'}<span class="dot">•</span>{/if}
      </button>
    {/each}
    {#if gameState.opponents.length === 0}
      <div class="empty-note">No opponents yet</div>
    {/if}
  </div>

  {#if previewOpponent}
    <button class="mini-popover-backdrop" aria-label="Close opponent preview" onclick={() => { previewOpponentId = null }}></button>
    <div class="opp-preview-popover">
      <div class="opp-preview-header">
        <strong>{previewOpponent.name}</strong>
        <button class="btn-ghost" onclick={() => { previewOpponentId = null }}>Close</button>
      </div>
      <div class="opp-preview-meta">
        Hand {previewOpponent.handCount} · Face-down {previewOpponent.faceDownCount}
      </div>
      <div class="opp-preview-label">Face Up</div>
      <div class="opp-preview-cards">
        {#if previewOpponent.faceUp.length > 0}
          {#each previewOpponent.faceUp as card}
            <div class="card front sm" class:black-suit={!isRed(card.suit)} class:special={isSpecial(card.rank)}>
              <div><div class="card-rank sm-rank">{rankLabel(card.rank)}</div><div class="card-suit sm-suit">{suitSymbol(card.suit)}</div></div>
            </div>
          {/each}
        {:else}
          <div class="opp-preview-empty">No face-up cards yet</div>
        {/if}
      </div>
      <div class="opp-preview-label">Face Down</div>
      <div class="opp-preview-cards">
        {#if previewOpponent.faceDownCount > 0}
          {#each { length: previewOpponent.faceDownCount } as _}
            <div class="card sm fd-back"><div class="fd-question">?</div></div>
          {/each}
        {:else}
          <div class="opp-preview-empty">No face-down cards</div>
        {/if}
      </div>
    </div>
  {/if}

  {#if showSelfStacks}
    <button class="mini-popover-backdrop" aria-label="Close my cards preview" onclick={() => { showSelfStacks = false }}></button>
    <div class="opp-preview-popover self-preview-popover">
      <div class="opp-preview-header">
        <strong>Your hidden cards</strong>
        <button class="btn-ghost" onclick={() => { showSelfStacks = false }}>Close</button>
      </div>
      {#if self.faceUp.length > 0 && !showFaceUpRow}
        <div class="opp-preview-label">Face Up</div>
        <div class="opp-preview-cards">
          {#each self.faceUp as card}
            <div class="card front sm" class:black-suit={!isRed(card.suit)} class:special={isSpecial(card.rank)}>
              <div><div class="card-rank sm-rank">{rankLabel(card.rank)}</div><div class="card-suit sm-suit">{suitSymbol(card.suit)}</div></div>
            </div>
          {/each}
        </div>
      {/if}
      {#if self.faceDownIds.length > 0 && !showFaceDownRow}
        <div class="opp-preview-label">Face Down</div>
        <div class="opp-preview-cards">
          {#each self.faceDownIds as _}
            <div class="card sm fd-back"><div class="fd-question">?</div></div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if phase !== 'setup'}
    <div class="center-piles">
      <div class="pile-wrap">
        <div class="card back"></div>
        <div class="pile-label">Draw</div>
      </div>
      <div class="pile-wrap">
        {#if discardTop3.length === 0}
          <div class="card empty-pile"></div>
        {:else}
          {#each discardTop3 as card, i}
            <div
              class="card front"
              class:black-suit={!isRed(card.suit)}
              class:special={isSpecial(card.rank)}
              style="z-index:{i + 1}; position:absolute; transform: translate({(i - 1) * 2}px, {(2 - i) * 1.5}px) rotate({(i - 1) * 2}deg);"
            >
              <div><div class="card-rank">{rankLabel(card.rank)}</div><div class="card-suit">{suitSymbol(card.suit)}</div></div>
              {#if i === discardTop3.length - 1 && topCardCount > 1}
                <div class="top-card-count">{topCardCount}</div>
              {/if}
            </div>
          {/each}
        {/if}
        <div class="pile-label">Discard</div>
      </div>
    </div>
  {/if}

  <div class="self-name">{self.name}</div>

  {#if showFaceUpRow}
    <div class="hand-header faceup-header">
      <div class="stack-label">Face Up ({self.faceUp.length})</div>
    </div>
    <div class="your-hand stage-hand faceup-row">
      {#each self.faceUp as card}
        <button
          class="hand-card card front"
          class:black-suit={!isRed(card.suit)}
          class:special={isSpecial(card.rank)}
          class:selected={selectedIds.has(card.id)}
          class:playable={isMyTurn && activePile === 'faceUp' && phase === 'playing' && cardIsPlayable(card)}
          class:unplayable={isMyTurn && activePile === 'faceUp' && phase === 'playing' && !cardIsPlayable(card)}
          onclick={() => { if (phase === 'playing' && activePile === 'faceUp') onTogglePlay(card) }}
        >
          <div><div class="card-rank">{rankLabel(card.rank)}</div><div class="card-suit">{suitSymbol(card.suit)}</div></div>
          <div class="card-bg-suit">{suitSymbol(card.suit)}</div>
        </button>
      {/each}
      {#each { length: Math.max(0, 3 - self.faceUp.length) } as _}
        <div class="hand-card card back face-up-slot"></div>
      {/each}
    </div>
  {/if}

  {#if showFaceDownRow}
    <div class="hand-header facedown-header">
      <div class="stack-label">Face Down ({self.faceDownIds.length})</div>
    </div>
    <div class="your-hand stage-hand facedown-row">
      {#each self.faceDownIds as fdId}
        {@const isPeeked = peekedFdId === fdId}
        {@const pCard = isPeeked ? peekedCard : null}
        <button
          class="hand-card card"
          class:fd-back={!isPeeked}
          class:front={isPeeked}
          class:black-suit={isPeeked && pCard && !isRed(pCard.suit)}
          class:special={isPeeked && pCard && isSpecial(pCard.rank)}
          class:playable={isMyTurn && activePile === 'faceDown' && phase === 'playing' && (peekedFdId === null || isPeeked)}
          class:browsable={!isMyTurn && phase === 'playing'}
          class:locked={isMyTurn && !isPeeked && peekedFdId !== null}
          class:peeked={isPeeked}
          onclick={() => onPlayFaceDown(fdId)}
        >
          {#if isPeeked && pCard}
            <div><div class="card-rank">{rankLabel(pCard.rank)}</div><div class="card-suit">{suitSymbol(pCard.suit)}</div></div>
            <div class="card-bg-suit">{suitSymbol(pCard.suit)}</div>
          {:else}
            <div class="fd-question">?</div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if self.hand.length > 0}
    <div class="hand-header">
      <div class="stack-label">Hand ({self.hand.length})</div>
    </div>
    <div class="your-hand">
      {#each sortedHandCards as card, i}
        <button
          class="hand-card card front"
          class:black-suit={!isRed(card.suit)}
          class:special={isSpecial(card.rank)}
          class:selected={selectedIds.has(card.id)}
          class:playable={phase === 'playing' && isMyTurn && activePile === 'hand' && cardIsPlayable(card)}
          class:selectable={phase === 'setup' ? !self.hasSetFaceUp : (isMyTurn && activePile === 'hand' && cardIsPlayable(card))}
          class:unplayable={phase === 'playing' && isMyTurn && activePile === 'hand' && !cardIsPlayable(card)}
          class:throw-in={throwInIds.includes(card.id)}
          style={`z-index:${i};`}
          onclick={() => {
            if (phase === 'setup') onToggleSetup(card.id)
            else if (isMyTurn && activePile === 'hand') onTogglePlay(card)
            else if (throwInIds.includes(card.id)) onThrowIn()
          }}
        >
          <div><div class="card-rank">{rankLabel(card.rank)}</div><div class="card-suit">{suitSymbol(card.suit)}</div></div>
          <div class="card-bg-suit">{suitSymbol(card.suit)}</div>
        </button>
      {/each}
    </div>
  {/if}

  <div class="action-row">
    {#if phase === 'setup' && !self.hasSetFaceUp}
      <button class="btn-action" disabled={selectedIds.size !== 3} onclick={onConfirmSetup}>
        Confirm face-up ({selectedIds.size}/3)
      </button>
    {:else if phase === 'playing' && throwInRank !== null}
      <button class="btn-throw-in" onclick={onThrowIn}>
        Throw In! ({throwInIds.length}x{rankLabel(throwInRank)})
      </button>
    {:else if phase === 'playing' && isMyTurn}
      {#if selectedIds.size > 0}
        <button class="btn-action" onclick={onPlaySelected}>
          Play {selectedIds.size} card{selectedIds.size !== 1 ? 's' : ''}
        </button>
      {/if}
      {#if canPickUp}
        <button class="btn-pickup" onclick={onPickUpPile}>
          Pick up pile ({gameState.discardPile.length})
        </button>
      {/if}
    {/if}
  </div>

  {#if error}
    <div class="error-notice" role="alert">
      {error}
      <button class="error-dismiss" onclick={onDismissError}>✕</button>
    </div>
  {/if}

  <div class="footer-row" class:has-self-preview={hasHiddenSelfStacks}>
    <button class="btn-ghost" onclick={() => { showOpponents = true }}>Opponents</button>
    <button class="btn-ghost" onclick={() => { showInfo = true }}>Info</button>
    {#if hasHiddenSelfStacks}
      <button class="btn-ghost" onclick={() => { showSelfStacks = true }}>My Stacks</button>
    {/if}
    <button class="btn-leave" onclick={onLeave}>Leave Game</button>
  </div>
</div>

{#if showOpponents}
  <button class="sheet-backdrop" aria-label="Close opponents panel" onclick={() => { showOpponents = false }}></button>
  <div class="sheet">
    <div class="sheet-header">
      <strong>Opponents</strong>
      <button class="btn-ghost" onclick={() => { showOpponents = false }}>Close</button>
    </div>
    {#each gameState.opponents as opp}
      {@const isDisconnected = disconnectedIds.has(opp.id)}
      <div class="sheet-row">
        <div>
          <div class="opp-name">{opp.name}</div>
          <div class="opp-meta">Hand {opp.handCount} · Face-up {opp.faceUp.length} · Face-down {opp.faceDownCount}</div>
        </div>
        {#if gameState.currentPlayerId === opp.id && phase === 'playing'}<span class="tag turn">Turn</span>{/if}
        {#if isDisconnected}<span class="tag left">Left</span>{:else if opp.isFinished}<span class="tag done">Done</span>{/if}
      </div>
      {#if opp.handCount === 0 && opp.faceUp.length > 0}
        <div class="cards-inline compact">
          {#each opp.faceUp as card}
            <div class="card front sm" class:black-suit={!isRed(card.suit)} class:special={isSpecial(card.rank)}>
              <div><div class="card-rank sm-rank">{rankLabel(card.rank)}</div><div class="card-suit sm-suit">{suitSymbol(card.suit)}</div></div>
            </div>
          {/each}
        </div>
      {/if}
      {#if opp.faceDownCount > 0}
        <div class="cards-inline compact">
          {#each { length: opp.faceDownCount } as _}
            <div class="card sm fd-back"><div class="fd-question">?</div></div>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
{/if}

{#if showInfo}
  <button class="sheet-backdrop" aria-label="Close info panel" onclick={() => { showInfo = false }}></button>
  <div class="sheet">
    <div class="sheet-header">
      <strong>Game Info</strong>
      <button class="btn-ghost" onclick={() => { showInfo = false }}>Close</button>
    </div>
    <div class="sheet-row single">Phase: <strong>{phase}</strong></div>
    <div class="sheet-row single">Constraint: <strong>{constraintLabel}</strong></div>
    <div class="sheet-row single">Current player: <strong>{turnLabel}</strong></div>
  </div>
{/if}

<style>
  .mobile-board {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100vh;
    overflow-y: auto;
    padding: calc(4rem + var(--safe-area-top)) 0.7rem calc(7.7rem + var(--safe-area-bottom));
    background: radial-gradient(ellipse 120% 60% at 50% 50%, var(--felt) 0%, #0e1a13 55%, var(--bg) 100%);
  }
  .top-strip, .opponent-summary-row {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .turn-pill, .count-pill, .opp-chip {
    border: 1px solid rgba(255,255,255,0.16);
    border-radius: 999px;
    background: rgba(0,0,0,0.25);
    color: var(--text);
    font-size: 0.82rem;
    padding: 0.3rem 0.65rem;
  }
  .turn-pill { color: var(--gold); }
  .opp-chip { cursor: pointer; }
  .dot { color: var(--gold); }
  .empty-note {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .mini-popover-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.28);
    border: 0;
    padding: 0;
    z-index: 240;
  }

  .opp-preview-popover {
    position: fixed;
    left: 0.7rem;
    right: 0.7rem;
    top: calc(7rem + var(--safe-area-top));
    z-index: 241;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 12px;
    background: rgba(14,14,24,0.97);
    backdrop-filter: blur(8px);
    padding: 0.6rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }

  .self-preview-popover {
    top: auto !important;
    bottom: calc(4.2rem + var(--safe-area-bottom)) !important;
  }

  .opp-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
  }

  .opp-preview-meta {
    font-size: 0.78rem;
    color: var(--muted);
    margin-bottom: 0.45rem;
  }

  .opp-preview-label {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.7);
    margin: 0.2rem 0 0.25rem;
  }

  .opp-preview-cards {
    display: flex;
    justify-content: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .opp-preview-empty {
    font-size: 0.78rem;
    color: var(--muted);
    padding: 0.3rem 0;
  }

  .center-piles {
    display: flex;
    justify-content: center;
    gap: 2.6rem;
    margin: 0.15rem 0 0.45rem;
  }
  .pile-wrap { text-align: center; position: relative; width: 62px; height: 96px; }
  .pile-label {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: -1.05rem;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.6);
    white-space: nowrap;
  }

  .self-name {
    text-align: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.1em;
    color: var(--neon);
  }
  .stack-label {
    min-width: 3.7rem;
    font-size: 0.76rem;
    color: rgba(255,255,255,0.7);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .cards-inline {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
  }
  .cards-inline.compact { padding-left: 0.1rem; }

  .hand-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .stage-hand {
    min-height: 122px;
    padding: 6px 0 12px;
    gap: 10px;
    justify-content: center;
  }
  .your-hand {
    display: flex;
    position: relative;
    height: auto;
    width: 100%;
    overflow-x: auto;
    overflow-y: visible;
    padding: 4px 0 10px;
    gap: 7px;
    flex-wrap: nowrap;
    justify-content: center;
  }
  .hand-card {
    position: relative;
    bottom: auto;
    flex-shrink: 0;
  }

  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    justify-content: center;
    min-height: 2.4rem;
    margin-bottom: 0.2rem;
  }
  .footer-row {
    position: fixed;
    left: 0.6rem;
    right: 0.6rem;
    bottom: calc(0.5rem + var(--safe-area-bottom));
    z-index: 220;
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.45rem;
    align-items: center;
    background: rgba(14,14,24,0.92);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 0.45rem;
    backdrop-filter: blur(8px);
  }

  .footer-row.has-self-preview {
    grid-template-columns: 1fr 1fr auto auto;
  }

  .btn-action, .btn-pickup, .btn-throw-in, .btn-leave, .btn-ghost {
    min-height: 42px;
    border-radius: 8px;
    font-size: 0.9rem;
    padding: 0.4rem 0.8rem;
  }
  .btn-action {
    background: var(--neon);
    color: white;
    border: none;
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 0.08em;
  }
  .btn-action:disabled { opacity: 0.4; }
  .btn-pickup {
    background: none;
    border: 1px solid rgba(255,190,11,0.4);
    color: var(--gold);
    font-family: 'Bebas Neue', sans-serif;
  }
  .btn-throw-in {
    background: linear-gradient(135deg, rgba(255,140,0,0.2), rgba(255,80,0,0.2));
    border: 1px solid rgba(255,140,0,0.7);
    color: #ffa040;
    font-family: 'Bebas Neue', sans-serif;
  }
  .btn-ghost {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    color: var(--text);
  }
  .btn-leave {
    background: rgba(230,57,70,0.15);
    border: 1px solid rgba(230,57,70,0.55);
    color: #ff8a93;
  }

  .error-notice {
    background: rgba(230,57,70,0.15);
    border: 1px solid rgba(230,57,70,0.4);
    border-radius: 6px;
    color: #ff6b75;
    font-size: 0.75rem;
    padding: 0.3rem 0.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .error-dismiss {
    background: none;
    border: none;
    color: inherit;
  }

  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    border: 0;
    padding: 0;
    z-index: 250;
  }
  .sheet {
    position: fixed;
    left: 0.5rem;
    right: 0.5rem;
    bottom: calc(3.9rem + var(--safe-area-bottom));
    max-height: 62vh;
    overflow-y: auto;
    background: rgba(14,14,24,0.98);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px;
    z-index: 251;
    padding: 0.6rem;
  }
  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
  }
  .sheet-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    padding: 0.45rem 0;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .sheet-row.single {
    justify-content: flex-start;
    font-size: 0.85rem;
  }
  .opp-name { font-size: 0.9rem; }
  .opp-meta { font-size: 0.72rem; color: var(--muted); }
  .tag {
    border-radius: 999px;
    padding: 0.1rem 0.4rem;
    font-size: 0.65rem;
  }
  .tag.turn { background: rgba(255,190,11,0.2); color: var(--gold); }
  .tag.left { background: rgba(230,57,70,0.25); color: #ff8a93; }
  .tag.done { background: rgba(255,255,255,0.2); color: #ddd; }

  .card {
    width: 60px;
    height: 86px;
    border-radius: 7px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 5px 6px;
    font-family: 'Bebas Neue', sans-serif;
    position: relative;
    border: none;
  }
  .card.sm {
    width: 52px;
    height: 75px;
    border-radius: 6px;
  }
  .card.back {
    background: linear-gradient(135deg, #7a0000 0%, #b01020 100%);
    border: 1px solid rgba(220,100,70,0.5);
  }
  .card.fd-back {
    background: linear-gradient(135deg, #7a0000 0%, #c0152a 100%);
    border: 1px solid rgba(255,100,100,0.3);
  }
  .card.front {
    background: var(--cream);
    border: 1px solid rgba(0,0,0,0.08);
    color: var(--red);
  }
  .card.front.black-suit { color: var(--ink); }
  .card.special { box-shadow: 0 0 10px rgba(247,37,133,0.35); }
  .card.empty-pile {
    border: 2px dashed rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.04);
  }
  .card.face-up-slot {
    border: 1px dashed rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.04);
  }
  .card.playable {
    cursor: pointer;
    transform: scale(1.08);
    box-shadow: 0 0 14px rgba(255,190,11,0.4);
    z-index: 3;
  }
  .card.selected {
    outline: 2px solid var(--gold);
    outline-offset: 1px;
  }
  .card.unplayable, .card.locked {
    opacity: 0.35;
    filter: grayscale(60%);
  }
  .card.peeked {
    box-shadow: 0 0 10px rgba(255,190,11,0.5);
    border-color: rgba(255,190,11,0.6);
  }
  .card-rank { font-size: 0.9rem; line-height: 1; }
  .card-suit { font-size: 0.7rem; line-height: 1; }
  .sm-rank { font-size: 0.9rem; line-height: 1; }
  .sm-suit { font-size: 0.62rem; line-height: 1; }
  .card-bg-suit {
    position: absolute;
    right: 5px;
    bottom: 4px;
    font-size: 1.4rem;
    opacity: 0.2;
    transform: rotate(180deg);
  }
  .fd-question {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.7rem;
    color: rgba(220,50,50,0.9);
  }
  .top-card-count {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #e53;
    color: white;
    font-size: 0.55rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-board.playing-hand .center-piles {
    gap: 3rem;
    margin: 0.2rem 0 0.65rem;
  }

  .mobile-board.playing-hand .pile-wrap {
    width: 72px;
    height: 108px;
  }

  .mobile-board.playing-hand .center-piles .card {
    width: 70px;
    height: 102px;
    border-radius: 8px;
    padding: 6px 7px;
  }

  .mobile-board.playing-hand .your-hand {
    min-height: 138px;
    padding: 8px 0 14px;
    gap: 10px;
  }

  .mobile-board.playing-hand .your-hand .card {
    width: 74px;
    height: 108px;
    border-radius: 9px;
    padding: 7px 8px;
  }

  .mobile-board.playing-hand .your-hand .card-rank {
    font-size: 1.15rem;
  }

  .mobile-board.playing-hand .your-hand .card-suit {
    font-size: 0.85rem;
  }

  .mobile-board.playing-faceup .center-piles,
  .mobile-board.playing-facedown .center-piles {
    gap: 3rem;
    margin: 0.2rem 0 0.65rem;
  }

  .mobile-board.playing-faceup .pile-wrap,
  .mobile-board.playing-facedown .pile-wrap {
    width: 72px;
    height: 108px;
  }

  .mobile-board.playing-faceup .center-piles .card,
  .mobile-board.playing-facedown .center-piles .card {
    width: 70px;
    height: 102px;
    border-radius: 8px;
    padding: 6px 7px;
  }

  .mobile-board.playing-faceup .faceup-row,
  .mobile-board.playing-facedown .facedown-row {
    margin-top: 0.25rem;
    margin-bottom: 0.35rem;
    min-height: 138px;
    padding: 8px 0 14px;
    gap: 10px;
  }

  .mobile-board.playing-faceup .faceup-row .card,
  .mobile-board.playing-facedown .facedown-row .card {
    width: 74px;
    height: 108px;
    border-radius: 9px;
    padding: 7px 8px;
  }

  .mobile-board.playing-faceup .faceup-row .card-rank,
  .mobile-board.playing-facedown .facedown-row .card-rank {
    font-size: 1.15rem;
  }

  .mobile-board.playing-faceup .faceup-row .card-suit,
  .mobile-board.playing-facedown .facedown-row .card-suit {
    font-size: 0.85rem;
  }
</style>
