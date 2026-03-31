<script lang="ts">
  import type { Card, Rank, Suit } from '$shared/types.ts'
  import { connection } from '$lib/ws.svelte'

  // ── Helpers ───────────────────────────────────────────────────────────────
  const FACE_RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
  function rankLabel(r: Rank): string { return FACE_RANKS[r] ?? String(r) }
  function suitSymbol(s: Suit): string {
    return { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }[s]
  }
  function isRed(s: Suit): boolean { return s === 'hearts' || s === 'diamonds' }
  function isSpecial(r: Rank): boolean { return ([2, 3, 7, 8, 10] as Rank[]).includes(r) }

  // ── Reactive state ────────────────────────────────────────────────────────
  const gs      = $derived(connection.gameState)
  const self    = $derived(gs?.self)
  const phase   = $derived(gs?.phase ?? 'setup')
  const isMyTurn = $derived(gs?.currentPlayerId === connection.playerId)

  // Which pile is active for the current player
  const activePile = $derived(
    !self            ? 'hand'     as const :
    self.hand.length  > 0 ? 'hand'     as const :
    self.faceUp.length > 0 ? 'faceUp'  as const :
                             'faceDown' as const
  )

  // ── Playability (mirrors server rules.ts) ────────────────────────────────
  function cardIsPlayable(card: Card): boolean {
    if (phase !== 'playing' || !gs) return true
    const { rank } = card
    if (rank === 2 || rank === 3 || rank === 10) return true
    const { constraint, effectiveTop } = gs
    if (constraint === 'after2') return rank !== 7
    if (constraint === 'after7') return rank <= 7
    if (effectiveTop === null) return true
    if (rank === 7) return effectiveTop.rank >= 7
    return rank >= effectiveTop.rank
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  let selectedIds = $state(new Set<string>())

  // Clear selection and peek whenever the active player or phase changes
  $effect(() => {
    const _id    = gs?.currentPlayerId
    const _phase = gs?.phase
    selectedIds = new Set()
    if (!isMyTurn) connection.clearPeek()
  })

  // Active cards for playability checks
  const activeCards = $derived(
    !self ? [] :
    activePile === 'hand' ? self.hand :
    activePile === 'faceUp' ? self.faceUp :
    []
  )

  // Show pickup button only when no valid play exists
  const canPickUp = $derived(
    isMyTurn &&
    gs !== null &&
    gs.discardPile.length > 0 &&
    activePile !== 'faceDown' &&
    !activeCards.some(c => cardIsPlayable(c))
  )

  // Setup phase: pick exactly 3 cards from hand for face-up
  function toggleSetup(id: string) {
    if (!self || self.hasSetFaceUp) return
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else if (next.size < 3) {
      next.add(id)
    }
    selectedIds = next
  }

  function confirmSetup() {
    connection.setFaceUp([...selectedIds])
    selectedIds = new Set()
  }

  // Playing phase: click selects all same-rank playable cards; click again deselects one
  function togglePlay(card: Card) {
    if (!isMyTurn || !self) return
    if (!cardIsPlayable(card)) return
    const next = new Set(selectedIds)
    if (next.has(card.id)) {
      next.delete(card.id)
    } else {
      const pool = activePile === 'hand' ? self.hand : self.faceUp
      const firstSelected = next.size > 0 ? pool.find(c => next.has(c.id)) : null
      if (firstSelected && firstSelected.rank !== card.rank) {
        next.clear()
      }
      // Auto-select all cards of this rank in the active pile
      pool.filter(c => c.rank === card.rank).forEach(c => next.add(c.id))
    }
    selectedIds = next
  }

  function playSelected() {
    if (selectedIds.size === 0) return
    connection.playCard([...selectedIds])
    selectedIds = new Set()
  }

  // Double-click: immediately play all cards of this rank in the active pile
  function playNow(card: Card) {
    if (!isMyTurn || !self) return
    if (!cardIsPlayable(card)) return
    const pool = activePile === 'hand' ? self.hand : self.faceUp
    const ids = pool.filter(c => c.rank === card.rank).map(c => c.id)
    connection.playCard(ids)
    selectedIds = new Set()
  }

  // Face-down: first click peeks, second click (or dblclick) plays.
  // Once a card is peeked, clicking another card is blocked.
  function playFaceDown(id: string) {
    if (!isMyTurn || activePile !== 'faceDown' || phase !== 'playing') return
    if (connection.peekedFdId !== null) {
      // A card is already peeked — only allow playing that same card
      if (connection.peekedFdId === id) {
        connection.playCard([id])
        connection.clearPeek()
      }
      return
    }
    connection.peekFaceDown(id)
  }

  // ── Discard pile display (top 3) ──────────────────────────────────────────
  const discardTop3 = $derived(gs?.discardPile.slice(-3) ?? [])

  const topCardCount = $derived((() => {
    const pile = gs?.discardPile
    if (!pile || pile.length === 0) return 0
    const topRank = pile[pile.length - 1].rank
    let count = 0
    for (let i = pile.length - 1; i >= 0 && pile[i].rank === topRank; i--) count++
    return count
  })())

  const DISCARD_OFFSETS = [
    'transform: rotate(-4deg) translate(-3px, 2px);',
    'transform: rotate(2deg) translate(1px, -1px);',
    '',
  ]
  function discardCardStyle(i: number, total: number): string {
    return DISCARD_OFFSETS[i + (3 - total)] ?? ''
  }

  // ── Labels ────────────────────────────────────────────────────────────────
  const constraintLabel = $derived(
    gs?.constraint === 'after2' ? 'No 7s' :
    gs?.constraint === 'after7' ? '≤ 7 only' :
    ''
  )

  const turnLabel = $derived(
    phase === 'setup'    ? (self?.hasSetFaceUp ? 'Waiting for others…' : 'Pick 3 face-up cards') :
    phase === 'finished' ? '' :
    isMyTurn             ? 'Your Turn' :
    (connection.players.find(p => p.id === gs?.currentPlayerId)?.name ?? '?') + "'s Turn"
  )

  // ── Loser overlay ─────────────────────────────────────────────────────────
  const loserName = $derived(
    gs?.loser
      ? (connection.players.find(p => p.id === gs.loser)?.name ?? 'Someone')
      : null
  )

  const SYMBOLS = ['♠','♣','♥','♦','A','K','Q','J','10','7','2']
  let rainCards = $state<{
    left: string; duration: string; delay: string; size: string; color: string; symbol: string
  }[]>([])

  $effect(() => {
    if (gs?.phase === 'finished') {
      rainCards = Array.from({ length: 40 }, () => ({
        left:     Math.random() * 100 + 'vw',
        duration: (1.5 + Math.random() * 2) + 's',
        delay:    (Math.random() * 0.5) + 's',
        size:     (0.8 + Math.random() * 1.2) + 'rem',
        color:    Math.random() > 0.5 ? 'rgba(230,57,70,0.5)' : 'rgba(255,255,255,0.3)',
        symbol:   SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      }))
    }
  })

  // ── Hand fan layout ───────────────────────────────────────────────────────
  let handEl = $state<HTMLDivElement | undefined>()
  let containerWidth = $state(340)

  $effect(() => {
    const el = handEl
    if (!el) return
    containerWidth = el.offsetWidth || 340
    const obs = new ResizeObserver(entries => {
      containerWidth = entries[0].contentRect.width
    })
    obs.observe(el)
    return () => obs.disconnect()
  })

  const fanCards = $derived.by(() => {
    const cards = [...(self?.hand ?? [])].sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : a.suit.localeCompare(b.suit))
    const total = cards.length
    if (total === 0) return []
    const spread   = Math.min(40, (containerWidth - 72) / Math.max(total - 1, 1))
    const rotSpread = Math.min(6, 30 / Math.max(total, 1))
    const centerX  = containerWidth / 2 - 36
    return cards.map((c, i) => {
      const offset = i - (total - 1) / 2
      return { card: c, tx: centerX + offset * spread, rot: offset * rotSpread, ty: Math.abs(offset) * 3 }
    })
  })
</script>

{#if gs && self}
<!-- Game table -->
<div class="game-table">

  <!-- Opponents row -->
  <div class="opponents-row">
    {#each gs.opponents as opp}
      <div class="opponent-area" class:finished={opp.isFinished}>
        <div class="opponent-name-tag">
          {opp.name}
          {#if opp.isFinished}<span class="badge-done">Done</span>{/if}
        </div>
        <!-- Face-down backs -->
        <div class="opp-row">
          {#each { length: opp.faceDownCount } as _}
            <div class="mini-card back"><span class="mini-fd-q">?</span></div>
          {/each}
          {#each { length: Math.max(0, 3 - opp.faceDownCount) } as _}
            <div class="mini-card empty"></div>
          {/each}
        </div>
        <!-- Face-up cards -->
        <div class="opp-row">
          {#each opp.faceUp as card}
            <div class="mini-card front" class:red={isRed(card.suit)} class:special={isSpecial(card.rank)}>
              <span class="mini-rank">{rankLabel(card.rank)}</span><span class="mini-suit">{suitSymbol(card.suit)}</span>
            </div>
          {/each}
          {#each { length: Math.max(0, 3 - opp.faceUp.length) } as _}
            <div class="mini-card empty"></div>
          {/each}
        </div>
        <div class="opp-hand-count">{opp.handCount} in hand</div>
      </div>
    {/each}

    {#if gs.opponents.length === 0}
      <div class="no-opponents">No opponents yet</div>
    {/if}
  </div>

  <!-- Center action area -->
  <div class="center-table">
    <div
      class="turn-banner"
      class:my-turn={isMyTurn && phase === 'playing'}
      class:setup-mode={phase === 'setup'}
    >
      {turnLabel}
      {#if constraintLabel && phase === 'playing'}
        <span class="constraint-badge">{constraintLabel}</span>
      {/if}
    </div>

    {#if phase !== 'setup'}
      <div class="center-row">
        <!-- Draw deck -->
        <div class="pile-wrap">
          <div class="draw-deck">
            {#if gs.drawPileCount > 2}<div class="card back" style="transform:translate(-2px,3px)"></div>{/if}
            {#if gs.drawPileCount > 1}<div class="card back" style="transform:translate(-1px,1px)"></div>{/if}
            {#if gs.drawPileCount > 0}<div class="card back"></div>
            {:else}<div class="card empty-pile"></div>{/if}
          </div>
          <div class="pile-label">Draw ({gs.drawPileCount})</div>
        </div>

        <!-- Discard pile -->
        <div class="pile-wrap">
          <div class="discard-pile">
            {#if discardTop3.length === 0}
              <div class="card empty-pile"></div>
            {:else}
              {#each discardTop3 as card, i}
                <div
                  class="card front"
                  class:black-suit={!isRed(card.suit)}
                  class:special={isSpecial(card.rank)}
                  style="z-index:{i + 1}; position:absolute; {discardCardStyle(i, discardTop3.length)}"
                >
                  <div><div class="card-rank">{rankLabel(card.rank)}</div><div class="card-suit">{suitSymbol(card.suit)}</div></div>
                  <div class="card-bg-suit">{suitSymbol(card.suit)}</div>
                  {#if i === discardTop3.length - 1 && topCardCount > 1}
                    <div class="top-card-count">{topCardCount}</div>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
          <div class="pile-label">Discard ({gs.discardPile.length})</div>
          {#if gs.effectiveTop && discardTop3.length > 0 && discardTop3[discardTop3.length - 1].rank === 3}
            <div class="effective-top-label">
              effective: {rankLabel(gs.effectiveTop.rank)}{suitSymbol(gs.effectiveTop.suit)}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Your area -->
  <div class="your-area">
    <div class="your-name-tag">{self.name}</div>

    <!-- Face-down row -->
    <div class="your-facedown-row">
      {#each self.faceDownIds as fdId}
        {@const isPeeked = connection.peekedFdId === fdId}
        {@const peekedCard = isPeeked ? connection.peekedCard : null}
        <button
          class="card sm"
          class:fd-back={!isPeeked}
          class:front={isPeeked}
          class:black-suit={isPeeked && peekedCard && !isRed(peekedCard.suit)}
          class:special={isPeeked && peekedCard && isSpecial(peekedCard.rank)}
          class:playable={isMyTurn && activePile === 'faceDown' && phase === 'playing' && (connection.peekedFdId === null || isPeeked)}
          class:locked={!isPeeked && connection.peekedFdId !== null}
          class:peeked={isPeeked}
          aria-label={isPeeked ? 'Play this card' : 'Flip face-down card'}
          onclick={() => playFaceDown(fdId)}
        >
          {#if isPeeked && peekedCard}
            <div><div class="card-rank sm-rank">{rankLabel(peekedCard.rank)}</div><div class="card-suit sm-suit">{suitSymbol(peekedCard.suit)}</div></div>
          {:else}
            <div class="fd-question">?</div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Face-up row (shows empty slots during setup before confirming) -->
    <div class="your-faceup-row">
      {#each self.faceUp as card}
        <button
          class="card front sm"
          class:black-suit={!isRed(card.suit)}
          class:special={isSpecial(card.rank)}
          class:selected={selectedIds.has(card.id)}
          class:playable={isMyTurn && activePile === 'faceUp' && phase === 'playing' && cardIsPlayable(card)}
          class:unplayable={isMyTurn && activePile === 'faceUp' && phase === 'playing' && !cardIsPlayable(card)}
          onclick={() => { if (phase === 'playing' && activePile === 'faceUp') togglePlay(card) }}
          ondblclick={() => { if (phase === 'playing' && activePile === 'faceUp') playNow(card) }}
        >
          <div><div class="card-rank sm-rank">{rankLabel(card.rank)}</div><div class="card-suit sm-suit">{suitSymbol(card.suit)}</div></div>
        </button>
      {/each}
      {#each { length: Math.max(0, 3 - self.faceUp.length) } as _}
        <div class="card back sm face-up-slot"></div>
      {/each}
    </div>

    <!-- Fanned hand -->
    {#if self.hand.length > 0}
      <div class="your-hand" bind:this={handEl}>
        {#each fanCards as { card, tx, rot, ty }, i}
          <button
            class="hand-card card front"
            class:black-suit={!isRed(card.suit)}
            class:special={isSpecial(card.rank)}
            class:selected={selectedIds.has(card.id)}
            class:selectable={phase === 'setup' ? !self.hasSetFaceUp : (isMyTurn && activePile === 'hand' && cardIsPlayable(card))}
            class:unplayable={phase === 'playing' && isMyTurn && activePile === 'hand' && !cardIsPlayable(card)}
            style="left:{tx}px; transform: rotate({rot}deg) translateY({ty}px); z-index:{i};"
            onclick={() => { if (phase === 'setup') toggleSetup(card.id); else if (activePile === 'hand') togglePlay(card) }}
            ondblclick={() => { if (phase === 'playing' && activePile === 'hand') playNow(card) }}
          >
            <div><div class="card-rank">{rankLabel(card.rank)}</div><div class="card-suit">{suitSymbol(card.suit)}</div></div>
            <div class="card-bg-suit">{suitSymbol(card.suit)}</div>
          </button>
        {/each}
      </div>
    {:else if phase !== 'setup'}
      <div class="empty-hand-hint">
        {activePile === 'faceUp' ? 'Play from your face-up cards' : 'Play a face-down card'}
      </div>
    {/if}

    <!-- Action buttons -->
    <div class="action-row">
      {#if phase === 'setup' && !self.hasSetFaceUp}
        <button
          class="btn-action"
          disabled={selectedIds.size !== 3}
          onclick={confirmSetup}
        >
          Confirm face-up ({selectedIds.size}/3)
        </button>
      {:else if phase === 'playing' && isMyTurn}
        {#if selectedIds.size > 0}
          <button class="btn-action" onclick={playSelected}>
            Play {selectedIds.size} card{selectedIds.size !== 1 ? 's' : ''}
          </button>
        {/if}
        {#if canPickUp}
          <button class="btn-pickup" onclick={() => connection.pickUpPile()}>
            Pick up pile ({gs.discardPile.length})
          </button>
        {/if}
      {/if}
    </div>

    <!-- Error notice -->
    {#if connection.error}
      <div class="error-notice" role="alert">
        {connection.error}
        <button class="error-dismiss" onclick={() => { connection.error = null }}>✕</button>
      </div>
    {/if}

    <button class="btn-leave" onclick={() => connection.disconnect()}>Leave Game</button>
  </div>
</div>

<!-- Game-over overlay -->
{#if phase === 'finished'}
  {#if gs.loser === connection.playerId}
    <div class="card-rain" aria-hidden="true">
      {#each rainCards as rc}
        <div
          class="rain-card"
          style="left:{rc.left}; animation-duration:{rc.duration}; animation-delay:{rc.delay}; font-size:{rc.size}; color:{rc.color};"
        >{rc.symbol}</div>
      {/each}
    </div>
  {/if}

  <div class="loser-overlay" class:is-winner={gs.loser !== connection.playerId}>
    {#if gs.loser === connection.playerId}
      <div class="loser-header">[ LOSER ]</div>
      <div class="loser-title">SHITHEAD</div>
      <div class="loser-name">You are the Shithead!</div>
    {:else if gs.loser}
      <div class="winner-header">[ WINNER ]</div>
      <div class="winner-title">YOU WIN!</div>
      <div class="winner-name">{loserName} is the Shithead</div>
    {:else}
      <div class="winner-header">GAME OVER</div>
      <div class="winner-name">Nobody lost this time</div>
    {/if}
    <button class="btn-primary" onclick={() => connection.returnToLobby()}>Back to Lobby</button>
  </div>
{/if}
{/if}

<style>
  .game-table {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 120% 60% at 50% 50%, var(--felt) 0%, #0e1a13 55%, var(--bg) 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 4.5rem 1rem 1rem;
    position: relative;
    overflow: hidden;
  }

  /* ── Opponents ── */
  .opponents-row {
    display: flex;
    gap: 2rem;
    justify-content: center;
    width: 100%;
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
  }

  .opponent-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    animation: fadeDown 0.5s ease both;
    opacity: 1;
    transition: opacity 0.3s;
  }

  .opponent-area.finished { opacity: 0.45; }

  .opponent-name-tag {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    background: rgba(0,0,0,0.4);
    padding: 0.2rem 0.7rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .badge-done {
    font-size: 0.6rem;
    background: var(--gold);
    color: var(--ink);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
  }

  .opp-row { display: flex; gap: 4px; }

  .no-opponents {
    font-family: 'Caveat', cursive;
    color: var(--muted);
    font-size: 1rem;
  }

  .opp-hand-count {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem;
    color: var(--muted);
    letter-spacing: 0.05em;
  }

  /* ── Mini cards ── */
  .mini-card {
    width: 44px;
    height: 62px;
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 0.9rem;
    position: relative;
  }

  .mini-rank { font-size: 1rem; line-height: 1; }
  .mini-suit { font-size: 0.7rem; line-height: 1; }
  .mini-fd-q { font-size: 1.3rem; color: rgba(220,50,50,0.9); text-shadow: 0 1px 3px rgba(0,0,0,0.6); }

  .mini-card.back {
    background: linear-gradient(135deg, #7a0000 0%, #c0152a 100%);
    border: 1px solid rgba(255,100,100,0.3);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255,80,80,0.18) 0px, rgba(255,80,80,0.18) 2px,
      transparent 2px, transparent 8px
    );
    box-shadow: 2px 3px 8px rgba(0,0,0,0.4);
  }

  .mini-card.front {
    background: var(--cream);
    border: 1px solid rgba(0,0,0,0.1);
    color: var(--ink);
    box-shadow: 2px 3px 8px rgba(0,0,0,0.4);
  }

  .mini-card.front.red { color: var(--red); }

  .mini-card.front.special {
    box-shadow: 2px 3px 8px rgba(0,0,0,0.4), 0 0 8px rgba(247,37,133,0.3);
    border-color: rgba(247,37,133,0.3);
  }

  .mini-card.empty {
    border: 1px dashed rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.03);
  }

  /* ── Full cards ── */
  .card {
    width: 72px;
    height: 104px;
    border-radius: 8px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 6px 8px;
    font-family: 'Bebas Neue', sans-serif;
    position: relative;
    transition: transform 0.15s, box-shadow 0.15s;
    border: none;
    cursor: default;
  }

  .card.back {
    background:
      repeating-linear-gradient(
        45deg,
        rgba(255,200,150,0.18) 0px, rgba(255,200,150,0.18) 2px,
        transparent 2px, transparent 8px
      ),
      linear-gradient(135deg, #7a0000 0%, #b01020 100%);
    border: 2px solid rgba(220,100,70,0.5);
    box-shadow:
      2px 4px 14px rgba(0,0,0,0.6),
      inset 0 0 0 3px rgba(100,0,0,0.6),
      inset 0 0 0 5px rgba(255,160,100,0.2);
  }

  /* Face-down cards — red with visible red stripe pattern */
  .card.fd-back {
    background: linear-gradient(135deg, #7a0000 0%, #c0152a 100%);
    border: 1px solid rgba(255,100,100,0.3);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255,80,80,0.18) 0px, rgba(255,80,80,0.18) 2px,
      transparent 2px, transparent 10px
    );
    box-shadow: 2px 4px 12px rgba(0,0,0,0.5);
  }

  .card.front {
    background: var(--cream);
    border: 1px solid rgba(0,0,0,0.08);
    color: var(--red);
    box-shadow: 3px 6px 16px rgba(0,0,0,0.5);
  }

  .card.front.black-suit { color: var(--ink); }

  .card.special {
    box-shadow: 3px 6px 16px rgba(0,0,0,0.5), 0 0 16px rgba(247,37,133,0.4);
    border-color: rgba(247,37,133,0.3);
  }

  .card.empty-pile {
    border: 2px dashed rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.03);
    box-shadow: none;
  }

  .card.face-up-slot {
    border: 1px dashed rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.04);
    box-shadow: none;
    opacity: 0.5;
  }

  .card.playable {
    cursor: pointer;
  }

  .card.playable:hover {
    transform: translateY(-8px) !important;
    box-shadow: 3px 10px 24px rgba(0,0,0,0.6) !important;
  }

  .card.selected {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
    box-shadow: 3px 6px 16px rgba(0,0,0,0.5), 0 0 16px rgba(255,190,11,0.4) !important;
    transform: translateY(-6px) !important;
  }

  .card-rank { font-size: 1.3rem; line-height: 1; }
  .card-suit { font-size: 0.9rem; line-height: 1; }

  .card-bg-suit {
    position: absolute;
    bottom: 6px;
    right: 8px;
    font-size: 1.8rem;
    opacity: 0.15;
    transform: rotate(180deg);
  }

  .top-card-count {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #e53;
    color: #fff;
    font-size: 0.7rem;
    font-weight: bold;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }

  /* Small cards */
  .card.sm {
    width: 64px;
    height: 92px;
    border-radius: 7px;
  }

  /* Unplayable cards */
  .card.unplayable {
    opacity: 0.35;
    cursor: not-allowed;
    filter: grayscale(60%);
  }

  /* Locked face-down cards (another fd card is already peeked) */
  .card.locked {
    opacity: 0.3;
    cursor: not-allowed;
    filter: grayscale(40%);
  }

  /* Peeked face-down card */
  .card.peeked {
    box-shadow: 3px 6px 16px rgba(0,0,0,0.5), 0 0 16px rgba(255,190,11,0.5);
    border-color: rgba(255,190,11,0.5);
  }

  /* Face-down question mark */
  .fd-question {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.2rem;
    color: rgba(220,50,50,0.9);
    text-shadow: 0 1px 4px rgba(0,0,0,0.6);
  }

  /* Effective top indicator */
  .effective-top-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    color: rgba(255,190,11,0.8);
    margin-top: 0.4rem;
    text-transform: uppercase;
  }

  .sm-rank { font-size: 1rem; line-height: 1; font-family: 'Bebas Neue', sans-serif; }
  .sm-suit { font-size: 0.7rem; line-height: 1; }

  /* ── Center ── */
  .center-table {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    justify-content: center;
  }

  .center-row {
    display: flex;
    align-items: center;
    gap: 2.5rem;
  }

  .pile-wrap { text-align: center; }

  .pile-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    color: rgba(255,255,255,0.25);
    margin-top: 1.8rem;
  }

  .draw-deck, .discard-pile {
    position: relative;
    width: 72px;
    height: 104px;
  }

  .draw-deck .card { position: absolute; }

  /* ── Turn banner ── */
  .turn-banner {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 0.4rem 1.2rem;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.15em;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .turn-banner.my-turn {
    background: rgba(255,190,11,0.1);
    border-color: rgba(255,190,11,0.3);
    color: var(--gold);
    animation: blink-border 2s ease-in-out infinite;
  }

  .turn-banner.setup-mode {
    background: rgba(114,9,183,0.1);
    border-color: rgba(114,9,183,0.35);
    color: #b45cff;
  }

  .constraint-badge {
    font-size: 0.75rem;
    background: rgba(247,37,133,0.15);
    border: 1px solid rgba(247,37,133,0.3);
    border-radius: 4px;
    padding: 0.15rem 0.5rem;
    color: var(--neon);
    letter-spacing: 0.05em;
  }

  /* ── Your area ── */
  .your-area {
    width: 100%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    animation: fadeUp 0.5s ease both;
  }

  .your-name-tag {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.12em;
    color: var(--neon);
    text-shadow: 0 0 10px rgba(247,37,133,0.4);
  }

  .your-facedown-row, .your-faceup-row {
    display: flex;
    gap: 6px;
  }

  /* Fanned hand */
  .your-hand {
    display: flex;
    position: relative;
    height: 120px;
    width: 100%;
    max-width: 500px;
    margin-bottom: 0.25rem;
  }

  .hand-card {
    position: absolute;
    bottom: 0;
    cursor: default;
  }

  .hand-card.selectable {
    cursor: pointer;
  }

  .hand-card.selectable:hover {
    transform: translateY(-16px) rotate(0deg) !important;
    box-shadow: 4px 8px 24px rgba(0,0,0,0.7), 0 0 16px rgba(247,37,133,0.25) !important;
    z-index: 10 !important;
  }

  .empty-hand-hint {
    font-family: 'Caveat', cursive;
    color: var(--muted);
    font-size: 0.95rem;
    padding: 0.5rem;
  }

  /* ── Action row ── */
  .action-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    min-height: 2.5rem;
  }

  .btn-action {
    background: var(--neon);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.1em;
    padding: 0.55rem 1.8rem;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.2s, opacity 0.15s;
    box-shadow: 0 4px 16px rgba(247,37,133,0.35);
  }

  .btn-action:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(247,37,133,0.5);
  }

  .btn-action:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .btn-pickup {
    background: none;
    border: 1px solid rgba(255,190,11,0.4);
    border-radius: 8px;
    color: var(--gold);
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1rem;
    letter-spacing: 0.1em;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
  }

  .btn-pickup:hover {
    background: rgba(255,190,11,0.1);
    box-shadow: 0 0 12px rgba(255,190,11,0.2);
  }

  /* ── Error notice ── */
  .error-notice {
    background: rgba(230,57,70,0.15);
    border: 1px solid rgba(230,57,70,0.4);
    border-radius: 6px;
    color: #ff6b75;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    padding: 0.4rem 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: fadeUp 0.2s ease;
  }

  .error-dismiss {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 0.75rem;
    opacity: 0.6;
    padding: 0;
    line-height: 1;
  }

  .error-dismiss:hover { opacity: 1; }

  .btn-leave {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: var(--muted);
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    padding: 0.35rem 1rem;
    transition: border-color 0.2s, color 0.2s;
    margin-top: 0.25rem;
  }

  .btn-leave:hover {
    border-color: var(--red);
    color: var(--red);
  }

  /* ── Loser / Winner overlay ── */
  .loser-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    animation: fadeIn 0.4s ease;
  }

  .loser-overlay.is-winner {
    background: rgba(0,20,0,0.88);
  }

  .loser-header {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 6rem;
    color: var(--red);
    text-shadow: 0 0 40px rgba(230,57,70,0.6);
    animation: fadeUp 0.5s ease;
    line-height: 1;
  }

  .loser-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(3rem, 10vw, 6rem);
    letter-spacing: 0.1em;
    color: var(--cream);
    animation: fadeUp 0.5s 0.1s ease both;
  }

  .loser-name {
    font-family: 'Caveat', cursive;
    font-size: 2rem;
    color: var(--muted);
    animation: fadeUp 0.5s 0.2s ease both;
  }

  .winner-header {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 6rem;
    color: var(--gold);
    text-shadow: 0 0 40px rgba(255,190,11,0.6);
    animation: fadeUp 0.5s ease;
    line-height: 1;
  }

  .winner-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(3rem, 10vw, 6rem);
    letter-spacing: 0.1em;
    color: var(--cream);
    animation: fadeUp 0.5s 0.1s ease both;
  }

  .winner-name {
    font-family: 'Caveat', cursive;
    font-size: 2rem;
    color: var(--muted);
    animation: fadeUp 0.5s 0.2s ease both;
  }

  .btn-primary {
    background: var(--neon);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem;
    letter-spacing: 0.12em;
    padding: 0.7rem 2.5rem;
    cursor: pointer;
    margin-top: 1rem;
    transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(247,37,133,0.35);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(247,37,133,0.5);
  }

  /* ── Card rain ── */
  .card-rain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 199;
  }

  .rain-card {
    position: absolute;
    top: -60px;
    font-family: 'Bebas Neue', sans-serif;
    animation: rainFall linear forwards;
  }
</style>
