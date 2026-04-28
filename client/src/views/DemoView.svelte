<script lang="ts">
  let { onBack }: { onBack: () => void } = $props()

  // ── Helpers ──────────────────────────────────────────────────────────────
  const FACE_RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
  function rl(r: number) { return FACE_RANKS[r] ?? String(r) }
  function ss(s: string) { return { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }[s] ?? s }
  function isRed(s: string) { return s === 'hearts' || s === 'diamonds' }
  function isSpecial(r: number) { return [2, 3, 7, 8, 10].includes(r) }

  type MockCard = { id: string; rank: number; suit: string }

  // ── Section: Individual card states ──────────────────────────────────────
  const suitSampler: MockCard[] = [
    { id: 'a1', rank: 14, suit: 'spades' },
    { id: 'a2', rank: 14, suit: 'hearts' },
    { id: 'a3', rank:  7, suit: 'clubs' },
    { id: 'a4', rank: 10, suit: 'diamonds' },
    { id: 'a5', rank:  2, suit: 'spades' },
    { id: 'a6', rank:  3, suit: 'hearts' },
    { id: 'a7', rank:  8, suit: 'clubs' },
    { id: 'a8', rank: 13, suit: 'diamonds' },
  ]

  // ── Section: Hand fan / spread ────────────────────────────────────────────
  const AUTO_SPREAD_THRESHOLD = 7
  const FEW_HAND: MockCard[] = [
    { id: 'f1', rank:  5, suit: 'clubs' },
    { id: 'f2', rank:  9, suit: 'hearts' },
    { id: 'f3', rank: 12, suit: 'spades' },
    { id: 'f4', rank:  4, suit: 'diamonds' },
    { id: 'f5', rank:  6, suit: 'clubs' },
  ]
  const MANY_HAND: MockCard[] = [
    { id: 'm1', rank:  3, suit: 'hearts' },
    { id: 'm2', rank:  5, suit: 'clubs' },
    { id: 'm3', rank:  7, suit: 'spades' },
    { id: 'm4', rank:  9, suit: 'diamonds' },
    { id: 'm5', rank: 10, suit: 'clubs' },
    { id: 'm6', rank: 11, suit: 'hearts' },
    { id: 'm7', rank: 13, suit: 'spades' },
    { id: 'm8', rank: 14, suit: 'diamonds' },
    { id: 'm9', rank:  2, suit: 'clubs' },
  ]

  let containerWidthFew  = $state(440)
  let containerWidthMany = $state(440)
  let elFew  = $state<HTMLDivElement | undefined>()
  let elMany = $state<HTMLDivElement | undefined>()

  $effect(() => {
    for (const [el, setter] of [[elFew, (w: number) => { containerWidthFew = w }], [elMany, (w: number) => { containerWidthMany = w }]] as [HTMLDivElement | undefined, (w: number) => void][]) {
      if (!el) continue
      setter(el.offsetWidth || 440)
      const obs = new ResizeObserver(e => setter(e[0].contentRect.width))
      obs.observe(el)
    }
  })

  function fanLayout(cards: MockCard[], containerWidth: number) {
    const total = cards.length
    if (total === 0) return []
    const spread    = Math.min(40, (containerWidth - 72) / Math.max(total - 1, 1))
    const rotSpread = Math.min(6, 30 / Math.max(total, 1))
    const centerX   = containerWidth / 2 - 36
    return cards.map((c, i) => {
      const offset = i - (total - 1) / 2
      return { card: c, tx: centerX + offset * spread, rot: offset * rotSpread, ty: Math.abs(offset) * 3 }
    })
  }

  let spreadPrefFew  = $state<boolean | null>(null)
  let spreadPrefMany = $state<boolean | null>(null)

  const spreadModeFew  = $derived(spreadPrefFew  ?? FEW_HAND.length  >= AUTO_SPREAD_THRESHOLD)
  const spreadModeMany = $derived(spreadPrefMany ?? MANY_HAND.length >= AUTO_SPREAD_THRESHOLD)

  const fanFew  = $derived(fanLayout(FEW_HAND,  containerWidthFew))
  const fanMany = $derived(fanLayout(MANY_HAND, containerWidthMany))

  let selectedFew  = $state(new Set<string>())
  let selectedMany = $state(new Set<string>())

  function toggleCard(set: Set<string>, id: string) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }

  // ── Section: Face-down peek ───────────────────────────────────────────────
  const FD_CARDS: MockCard[] = [
    { id: 'fd_0', rank:  9, suit: 'spades' },
    { id: 'fd_1', rank:  4, suit: 'hearts' },
    { id: 'fd_2', rank:  8, suit: 'clubs' },
  ]

  let peekedIdOffTurn = $state<string | null>(null)
  let peekedIdOnTurn  = $state<string | null>(null)

  function peekOffTurn(id: string) { peekedIdOffTurn = peekedIdOffTurn === id ? null : id }
  function peekOnTurn(id: string) {
    if (peekedIdOnTurn === id) { peekedIdOnTurn = null }
    else if (peekedIdOnTurn === null) { peekedIdOnTurn = id }
    // else: locked — can't switch while one is peeked
  }

  // ── Section: Action buttons ───────────────────────────────────────────────
  let btnMsg = $state('')
  function btnClick(label: string) {
    btnMsg = `"${label}" clicked`
    setTimeout(() => { btnMsg = '' }, 1500)
  }

  // ── Section: Turn banner ──────────────────────────────────────────────────
  let turnDemo = $state<'mine' | 'theirs' | 'setup'>('mine')
</script>

<div class="demo-bg"></div>

<div class="demo-wrap">

  <header class="demo-header">
    <button class="btn-back" onclick={onBack}>← Back</button>
    <div class="demo-title">UI Component Gallery</div>
    <div class="demo-subtitle">Review game components and interactions</div>
  </header>

  <!-- ── 1. Individual Card States ── -->
  <section class="demo-section">
    <h2 class="section-title">Card States</h2>

    <div class="subsection">
      <div class="sub-label">Face-up (red / black / special)</div>
      <div class="card-row">
        {#each suitSampler as card}
          <div class="card front {isRed(card.suit) ? '' : 'black-suit'} {isSpecial(card.rank) ? 'special' : ''}">
            <div><div class="card-rank">{rl(card.rank)}</div><div class="card-suit">{ss(card.suit)}</div></div>
            <div class="card-bg-suit">{ss(card.suit)}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="subsection">
      <div class="sub-label">Face-down back / empty slot</div>
      <div class="card-row">
        <div class="card fd-back"><div class="fd-question">?</div></div>
        <div class="card fd-back"><div class="fd-question">?</div></div>
        <div class="card fd-back"><div class="fd-question">?</div></div>
        <div class="card back"></div>
        <div class="card empty-pile"></div>
        <div class="card back face-up-slot"></div>
      </div>
    </div>

    <div class="subsection">
      <div class="sub-label">Interaction states</div>
      <div class="card-row">
        <div class="card front black-suit">
          <div><div class="card-rank">A</div><div class="card-suit">♠</div></div>
          <div class="card-bg-suit">♠</div>
          <div class="state-badge">default</div>
        </div>
        <div class="card front playable">
          <div><div class="card-rank">K</div><div class="card-suit">♠</div></div>
          <div class="card-bg-suit">♠</div>
          <div class="state-badge">playable</div>
        </div>
        <div class="card front selected">
          <div><div class="card-rank">Q</div><div class="card-suit">♥</div></div>
          <div class="card-bg-suit">♥</div>
          <div class="state-badge">selected</div>
        </div>
        <div class="card front unplayable">
          <div><div class="card-rank">5</div><div class="card-suit">♦</div></div>
          <div class="card-bg-suit">♦</div>
          <div class="state-badge">unplayable</div>
        </div>
        <div class="card fd-back locked">
          <div class="fd-question">?</div>
          <div class="state-badge">locked</div>
        </div>
        <div class="card fd-back peeked front">
          <div><div class="card-rank">8</div><div class="card-suit">♣</div></div>
          <div class="state-badge">peeked</div>
        </div>
        <div class="card fd-back browsable">
          <div class="fd-question">?</div>
          <div class="state-badge">browsable</div>
        </div>
      </div>
    </div>

    <div class="subsection">
      <div class="sub-label">Small cards (face-up row)</div>
      <div class="card-row">
        {#each suitSampler.slice(0, 5) as card}
          <div class="card front sm {isRed(card.suit) ? '' : 'black-suit'} {isSpecial(card.rank) ? 'special' : ''}">
            <div><div class="card-rank sm-rank">{rl(card.rank)}</div><div class="card-suit sm-suit">{ss(card.suit)}</div></div>
          </div>
        {/each}
        <div class="card back sm face-up-slot"></div>
        <div class="card back sm face-up-slot"></div>
        <div class="card sm fd-back"><div class="fd-question">?</div></div>
      </div>
    </div>
  </section>

  <!-- ── 2. Hand Fan / Spread ── -->
  <section class="demo-section">
    <h2 class="section-title">Hand Layout</h2>

    <div class="subsection">
      <div class="sub-label">
        Few cards ({FEW_HAND.length}) — auto fan
        <button class="btn-spread" onclick={() => spreadPrefFew = !spreadModeFew}
          title={spreadModeFew ? 'Fan view' : 'Spread view'}>
          {spreadModeFew ? '🂠' : '⊞'}
        </button>
      </div>
      <div class="hand-demo-wrap {spreadModeFew ? 'spread' : 'fan'}">
        <div class="your-hand {spreadModeFew ? 'spread' : ''}" bind:this={elFew}>
          {#each (spreadModeFew ? FEW_HAND : fanFew.map(f => f.card)) as card, i}
            {@const fd = spreadModeFew ? null : fanFew[i]}
            <button
              class="hand-card card front {isRed(card.suit) ? '' : 'black-suit'} {isSpecial(card.rank) ? 'special' : ''} selectable {selectedFew.has(card.id) ? 'selected' : ''}"
              style={fd ? `left:${fd.tx}px; transform: rotate(${fd.rot}deg) translateY(${fd.ty}px); z-index:${i};` : `z-index:${i};`}
              onclick={() => { selectedFew = toggleCard(selectedFew, card.id) }}
            >
              <div><div class="card-rank">{rl(card.rank)}</div><div class="card-suit">{ss(card.suit)}</div></div>
              <div class="card-bg-suit">{ss(card.suit)}</div>
            </button>
          {/each}
        </div>
      </div>
      <div class="demo-hint">Click cards to select. Toggle button switches layout.</div>
    </div>

    <div class="subsection">
      <div class="sub-label">
        Many cards ({MANY_HAND.length}) — auto spread (&ge;{AUTO_SPREAD_THRESHOLD})
        <button class="btn-spread" onclick={() => spreadPrefMany = !spreadModeMany}
          title={spreadModeMany ? 'Fan view' : 'Spread view'}>
          {spreadModeMany ? '🂠' : '⊞'}
        </button>
      </div>
      <div class="hand-demo-wrap {spreadModeMany ? 'spread' : 'fan'}">
        <div class="your-hand {spreadModeMany ? 'spread' : ''}" bind:this={elMany}>
          {#each (spreadModeMany ? MANY_HAND : fanMany.map(f => f.card)) as card, i}
            {@const fd = spreadModeMany ? null : fanMany[i]}
            <button
              class="hand-card card front {isRed(card.suit) ? '' : 'black-suit'} {isSpecial(card.rank) ? 'special' : ''} selectable {selectedMany.has(card.id) ? 'selected' : ''}"
              style={fd ? `left:${fd.tx}px; transform: rotate(${fd.rot}deg) translateY(${fd.ty}px); z-index:${i};` : `z-index:${i};`}
              onclick={() => { selectedMany = toggleCard(selectedMany, card.id) }}
            >
              <div><div class="card-rank">{rl(card.rank)}</div><div class="card-suit">{ss(card.suit)}</div></div>
              <div class="card-bg-suit">{ss(card.suit)}</div>
            </button>
          {/each}
        </div>
      </div>
      <div class="demo-hint">9 cards auto-enables spread. Toggle to switch back to fan.</div>
    </div>
  </section>

  <!-- ── 3. Face-down Peek ── -->
  <section class="demo-section">
    <h2 class="section-title">Face-down Peek</h2>

    <div class="subsections-row">
      <div class="subsection">
        <div class="sub-label">Off-turn — freely browse (click any card)</div>
        <div class="card-row">
          {#each FD_CARDS as fd}
            {@const isPeeked = peekedIdOffTurn === fd.id}
            {@const peekedCard = isPeeked ? fd : null}
            <button
              class="card sm {isPeeked ? 'front peeked' : 'fd-back'} {isPeeked && !isRed(fd.suit) ? 'black-suit' : ''} {isPeeked && isSpecial(fd.rank) ? 'special' : ''} browsable"
              onclick={() => peekOffTurn(fd.id)}
              aria-label={isPeeked ? 'Peeked card (strategy view)' : 'Peek face-down card'}
            >
              {#if peekedCard}
                <div><div class="card-rank sm-rank">{rl(peekedCard.rank)}</div><div class="card-suit sm-suit">{ss(peekedCard.suit)}</div></div>
              {:else}
                <div class="fd-question">?</div>
              {/if}
            </button>
          {/each}
        </div>
        <div class="demo-hint">Click any card to peek. Click again to hide. Freely switch.</div>
      </div>

      <div class="subsection">
        <div class="sub-label">On-turn — peek then play</div>
        <div class="card-row">
          {#each FD_CARDS as fd}
            {@const isPeeked = peekedIdOnTurn === fd.id}
            {@const isLocked = !isPeeked && peekedIdOnTurn !== null}
            <button
              class="card sm {isPeeked ? 'front peeked' : 'fd-back'} {isPeeked && !isRed(fd.suit) ? 'black-suit' : ''} {isPeeked && isSpecial(fd.rank) ? 'special' : ''} {isLocked ? 'locked' : 'playable'}"
              onclick={() => peekOnTurn(fd.id)}
              aria-label={isPeeked ? 'Play this card' : 'Flip face-down card'}
            >
              {#if isPeeked}
                <div><div class="card-rank sm-rank">{rl(fd.rank)}</div><div class="card-suit sm-suit">{ss(fd.suit)}</div></div>
              {:else}
                <div class="fd-question">?</div>
              {/if}
            </button>
          {/each}
        </div>
        <div class="demo-hint">Click to peek. Once peeked, other cards lock. Click peeked card again to "play".</div>
      </div>
    </div>
  </section>

  <!-- ── 4. Turn Banner ── -->
  <section class="demo-section">
    <h2 class="section-title">Turn Banner</h2>
    <div class="turn-toggle-row">
      <button class="tab {turnDemo === 'mine' ? 'active' : ''}" onclick={() => { turnDemo = 'mine' }}>My Turn</button>
      <button class="tab {turnDemo === 'theirs' ? 'active' : ''}" onclick={() => { turnDemo = 'theirs' }}>Opponent's Turn</button>
      <button class="tab {turnDemo === 'setup' ? 'active' : ''}" onclick={() => { turnDemo = 'setup' }}>Setup Phase</button>
    </div>
    <div class="turn-banner {turnDemo === 'mine' ? 'my-turn' : turnDemo === 'setup' ? 'setup-turn' : ''}">
      {#if turnDemo === 'mine'}
        Your Turn
      {:else if turnDemo === 'theirs'}
        Bob's Turn
      {:else}
        Pick 3 face-up cards
      {/if}
    </div>
  </section>

  <!-- ── 5. Action Buttons ── -->
  <section class="demo-section">
    <h2 class="section-title">Action Buttons</h2>
    <div class="subsection">
      <div class="card-row wrap">
        <button class="btn-action" onclick={() => btnClick('Play 2 cards')}>Play 2 cards</button>
        <button class="btn-pickup" onclick={() => btnClick('Pick up pile')}>Pick up pile (5)</button>
        <button class="btn-throw-in" onclick={() => btnClick('Throw In!')}>Throw In! (2×10)</button>
        <button class="btn-action" disabled onclick={() => btnClick('Confirm')}>Confirm face-up (0/3)</button>
        <button class="btn-primary-sm" onclick={() => btnClick('Back to Lobby')}>Back to Lobby</button>
      </div>
      {#if btnMsg}
        <div class="btn-feedback">{btnMsg}</div>
      {/if}
    </div>
  </section>

  <!-- ── 6. Constraint Labels ── -->
  <section class="demo-section">
    <h2 class="section-title">Constraint Labels</h2>
    <div class="card-row">
      <div class="constraint-badge">No 7s</div>
      <div class="constraint-badge after7">≤ 7 only</div>
      <div class="constraint-badge none">(no constraint)</div>
    </div>
  </section>

</div>

<style>
  /* ── Layout ── */
  .demo-bg {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 120% 60% at 50% 50%, var(--felt) 0%, #0e1a13 55%, var(--bg) 100%);
    z-index: 0;
  }

  .demo-wrap {
    position: relative;
    z-index: 1;
    max-width: 960px;
    margin: 0 auto;
    padding: 5rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .demo-header {
    text-align: center;
    position: relative;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .btn-back {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-back:hover { background: rgba(255,255,255,0.12); }

  .demo-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.2rem;
    letter-spacing: 0.1em;
    color: var(--cream);
  }

  .demo-subtitle {
    font-family: 'Caveat', cursive;
    color: var(--muted);
    font-size: 1rem;
    margin-top: 0.25rem;
  }

  /* ── Section ── */
  .demo-section {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.3rem;
    letter-spacing: 0.1em;
    color: var(--gold);
    margin: 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255,190,11,0.15);
  }

  .subsection {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .subsections-row {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .subsections-row .subsection { flex: 1; min-width: 200px; }

  .sub-label {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .demo-hint {
    font-family: 'Caveat', cursive;
    color: var(--muted);
    font-size: 0.9rem;
  }

  /* ── Card rows ── */
  .card-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .card-row.wrap { flex-wrap: wrap; gap: 10px; }

  /* state badges */
  .state-badge {
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.6rem;
    color: var(--muted);
    white-space: nowrap;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Full cards (copy from GameView) ── */
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
    flex-shrink: 0;
  }

  .card.back {
    background:
      repeating-linear-gradient(45deg, rgba(255,200,150,0.18) 0px, rgba(255,200,150,0.18) 2px, transparent 2px, transparent 8px),
      linear-gradient(135deg, #7a0000 0%, #b01020 100%);
    border: 2px solid rgba(220,100,70,0.5);
    box-shadow: 2px 4px 14px rgba(0,0,0,0.6), inset 0 0 0 3px rgba(100,0,0,0.6), inset 0 0 0 5px rgba(255,160,100,0.2);
  }

  .card.fd-back {
    background: linear-gradient(135deg, #7a0000 0%, #c0152a 100%);
    border: 1px solid rgba(255,100,100,0.3);
    background-image: repeating-linear-gradient(45deg, rgba(255,80,80,0.18) 0px, rgba(255,80,80,0.18) 2px, transparent 2px, transparent 10px);
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

  .card.playable { cursor: pointer; }
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

  .card.unplayable { opacity: 0.35; cursor: not-allowed; filter: grayscale(60%); }

  .card.locked { opacity: 0.3; cursor: not-allowed; filter: grayscale(40%); }

  .card.peeked {
    box-shadow: 3px 6px 16px rgba(0,0,0,0.5), 0 0 16px rgba(255,190,11,0.5);
    outline: 2px solid rgba(255,190,11,0.6);
    outline-offset: 2px;
  }

  .card.browsable { cursor: pointer; opacity: 0.9; }
  .card.browsable:hover {
    opacity: 1;
    box-shadow: 3px 6px 16px rgba(0,0,0,0.5), 0 0 10px rgba(147,112,219,0.4);
    transform: translateY(-4px);
  }

  .card.sm { width: 64px; height: 92px; border-radius: 7px; }

  .card-rank { font-size: 1.3rem; line-height: 1; }
  .card-suit { font-size: 0.9rem; line-height: 1; }
  .sm-rank   { font-size: 1.1rem; line-height: 1; }
  .sm-suit   { font-size: 0.75rem; line-height: 1; }

  .card-bg-suit {
    position: absolute;
    bottom: 6px;
    right: 8px;
    font-size: 1.8rem;
    opacity: 0.15;
    transform: rotate(180deg);
  }

  .fd-question {
    font-size: 1.8rem;
    color: rgba(220,50,50,0.9);
    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
    margin: auto;
    align-self: center;
    width: 100%;
    text-align: center;
  }

  /* ── Hand layout ── */
  .hand-demo-wrap {
    width: 100%;
    max-width: 500px;
  }

  .hand-demo-wrap.fan { height: 130px; position: relative; }

  .your-hand {
    display: flex;
    position: relative;
    height: 120px;
    width: 100%;
    max-width: 500px;
    margin-bottom: 0.25rem;
  }

  .your-hand.spread {
    height: auto;
    overflow-x: auto;
    overflow-y: visible;
    padding: 8px 4px 16px;
    gap: 6px;
    flex-wrap: nowrap;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.2) transparent;
  }

  .your-hand.spread .hand-card {
    position: relative;
    bottom: auto;
    flex-shrink: 0;
  }

  .hand-card {
    position: absolute;
    bottom: 0;
    cursor: default;
  }

  .hand-card.selectable { cursor: pointer; }

  .hand-card:hover {
    transform: translateY(-12px) rotate(0deg) !important;
    box-shadow: 4px 8px 24px rgba(0,0,0,0.7) !important;
    z-index: 100 !important;
  }

  .hand-card.selectable:hover {
    transform: translateY(-16px) rotate(0deg) !important;
    box-shadow: 4px 8px 24px rgba(0,0,0,0.7), 0 0 16px rgba(247,37,133,0.25) !important;
    z-index: 100 !important;
  }

  /* ── btn-spread ── */
  .btn-spread {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.13);
    border-radius: 6px;
    color: rgba(255,255,255,0.6);
    font-size: 0.9rem;
    padding: 0.15rem 0.45rem;
    cursor: pointer;
    line-height: 1;
    transition: background 0.15s, color 0.15s;
  }

  .btn-spread:hover { background: rgba(255,255,255,0.13); color: rgba(255,255,255,0.85); }

  /* ── Turn banner ── */
  .turn-toggle-row {
    display: flex;
    gap: 0.5rem;
  }

  .tab {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: var(--muted);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tab.active, .tab:hover { background: rgba(255,255,255,0.1); color: var(--text); }

  .turn-banner {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: var(--text);
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem;
    letter-spacing: 0.12em;
    padding: 0.5rem 1.2rem;
    text-align: center;
    max-width: 260px;
    transition: background 0.3s, border-color 0.3s, color 0.3s;
  }

  .turn-banner.my-turn {
    background: rgba(255,190,11,0.1);
    border-color: rgba(255,190,11,0.3);
    color: var(--gold);
    animation: blink-border 1.6s ease-in-out infinite;
  }

  .turn-banner.setup-turn {
    background: rgba(114,9,183,0.1);
    border-color: rgba(114,9,183,0.35);
    color: #b45cff;
  }

  /* ── Action buttons ── */
  .btn-action {
    background: linear-gradient(135deg, rgba(247,37,133,0.2), rgba(114,9,183,0.2));
    border: 1px solid rgba(247,37,133,0.5);
    border-radius: 8px;
    color: #ff6eb4;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.05em;
    padding: 0.5rem 1.4rem;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
  }

  .btn-action:hover { background: linear-gradient(135deg, rgba(247,37,133,0.35), rgba(114,9,183,0.35)); box-shadow: 0 0 16px rgba(247,37,133,0.3); }
  .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-pickup {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    color: var(--text);
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.05em;
    padding: 0.5rem 1.4rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-pickup:hover { background: rgba(255,255,255,0.12); }

  .btn-throw-in {
    background: linear-gradient(135deg, rgba(255,140,0,0.2), rgba(255,80,0,0.2));
    border: 1px solid rgba(255,140,0,0.7);
    border-radius: 8px;
    color: #ffa040;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.05em;
    padding: 0.5rem 1.4rem;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    animation: throw-in-btn-pulse 1s ease-in-out infinite alternate;
  }

  .btn-throw-in:hover { background: linear-gradient(135deg, rgba(255,140,0,0.35), rgba(255,80,0,0.35)); box-shadow: 0 0 16px rgba(255,140,0,0.4); }

  @keyframes throw-in-btn-pulse {
    from { box-shadow: 0 0 6px rgba(255,140,0,0.3); }
    to   { box-shadow: 0 0 14px rgba(255,140,0,0.7); }
  }

  .btn-primary-sm {
    background: var(--neon);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.1em;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 4px 16px rgba(247,37,133,0.35);
  }

  .btn-primary-sm:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(247,37,133,0.5); }

  .btn-feedback {
    font-family: 'Caveat', cursive;
    color: var(--gold);
    font-size: 1rem;
    padding-top: 0.25rem;
    animation: fadeIn 0.2s ease;
  }

  /* ── Constraint badges ── */
  .constraint-badge {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    color: var(--muted);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.7rem;
  }

  .constraint-badge.after7 {
    background: rgba(114,9,183,0.15);
    border-color: rgba(114,9,183,0.4);
    color: #b45cff;
  }

  .constraint-badge.none { opacity: 0.4; }
</style>
