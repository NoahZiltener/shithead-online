<script lang="ts">
  import { connection } from '$lib/ws.svelte'
  import { onMount } from 'svelte'

  // Demo hand cards — will be replaced when game state is wired up
  const demoHand = [
    { rank: 'A', suit: '♠', red: false },
    { rank: '7', suit: '♥', red: true  },
    { rank: '3', suit: '♦', red: true  },
    { rank: 'J', suit: '♣', red: false },
    { rank: '2', suit: '♥', red: true  },
    { rank: 'Q', suit: '♠', red: false },
  ]

  const opponents = $derived(
    connection.players.filter(p => p.id !== connection.playerId)
  )

  const myName = $derived(
    connection.players.find(p => p.id === connection.playerId)?.name ?? 'You'
  )

  // Hand fan layout
  let handEl: HTMLDivElement | undefined = $state()
  let handCards: { rank: string; suit: string; red: boolean; tx: number; rot: number; ty: number }[] = $state([])

  function buildHand() {
    if (!handEl) return
    const total = demoHand.length
    const spread = 32
    const rotSpread = 6
    const centerX = handEl.offsetWidth / 2 - 36
    handCards = demoHand.map((c, i) => {
      const offset = i - (total - 1) / 2
      return {
        ...c,
        tx: centerX + offset * spread,
        rot: offset * rotSpread,
        ty: Math.abs(offset) * 3,
      }
    })
  }

  onMount(() => {
    buildHand()
    window.addEventListener('resize', buildHand)
    return () => window.removeEventListener('resize', buildHand)
  })

  // Loser overlay (demo trigger via a card click for now)
  let showLoser = $state(false)
  let rainCards: { left: string; duration: string; delay: string; size: string; color: string; symbol: string }[] = $state([])

  const symbols = ['♠','♣','♥','♦','A','K','Q','J','10','7','2']

  function triggerLoser() {
    showLoser = true
    rainCards = Array.from({ length: 40 }, () => ({
      left: Math.random() * 100 + 'vw',
      duration: (1.5 + Math.random() * 2) + 's',
      delay: (Math.random() * 0.5) + 's',
      size: (0.8 + Math.random() * 1.2) + 'rem',
      color: Math.random() > 0.5 ? 'rgba(230,57,70,0.5)' : 'rgba(255,255,255,0.3)',
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
    }))
  }
</script>

<!-- Game table -->
<div class="game-table">

  <!-- Opponents row -->
  <div class="opponents-row">
    {#each opponents as opp}
      <div class="opponent-area">
        <div class="opponent-name-tag">{opp.name}</div>
        <div class="opp-row">
          <div class="mini-card back"></div>
          <div class="mini-card back"></div>
          <div class="mini-card back"></div>
        </div>
        <div class="opp-row">
          <div class="mini-card front red">7</div>
          <div class="mini-card front black">A</div>
          <div class="mini-card front red">Q</div>
        </div>
        <div class="opp-hand-count">5 cards</div>
      </div>
    {/each}

    {#if opponents.length === 0}
      <div class="no-opponents">No opponents yet</div>
    {/if}
  </div>

  <!-- Center action area -->
  <div class="center-table">
    <div class="turn-banner">Your Turn</div>

    <div class="center-row">
      <!-- Draw deck -->
      <div class="pile-wrap">
        <div class="draw-deck">
          <div class="card back"></div>
          <div class="card back"></div>
          <div class="card back"></div>
        </div>
        <div class="pile-label">Draw (18)</div>
      </div>

      <!-- Discard pile -->
      <div class="pile-wrap">
        <div class="discard-pile">
          <div class="card front black-suit">
            <div><div class="card-rank">J</div><div class="card-suit">♠</div></div>
            <div class="card-bg-suit">♠</div>
          </div>
          <div class="card front">
            <div><div class="card-rank">9</div><div class="card-suit">♥</div></div>
            <div class="card-bg-suit">♥</div>
          </div>
          <div class="card front special">
            <div><div class="card-rank">10</div><div class="card-suit">♦</div></div>
            <div class="card-bg-suit">♦</div>
          </div>
        </div>
        <div class="pile-label">Discard</div>
      </div>
    </div>
  </div>

  <!-- Your area -->
  <div class="your-area">
    <div class="your-name-tag">{myName}</div>

    <div class="your-facedown-row">
      <div class="card back sm"></div>
      <div class="card back sm"></div>
      <div class="card back sm"></div>
    </div>

    <div class="your-faceup-row">
      <div class="card front sm">
        <div><div class="card-rank sm-rank">5</div><div class="card-suit sm-suit">♥</div></div>
      </div>
      <div class="card front black-suit sm">
        <div><div class="card-rank sm-rank">K</div><div class="card-suit sm-suit">♣</div></div>
      </div>
      <div class="card front sm">
        <div><div class="card-rank sm-rank">2</div><div class="card-suit sm-suit">♦</div></div>
      </div>
    </div>

    <!-- Fanned hand -->
    <div class="your-hand" bind:this={handEl}>
      {#each handCards as c, i}
        <div
          class="hand-card card front"
          class:black-suit={!c.red}
          style="left:{c.tx}px; transform: rotate({c.rot}deg) translateY({c.ty}px); z-index:{i};"
        >
          <div><div class="card-rank">{c.rank}</div><div class="card-suit">{c.suit}</div></div>
          <div class="card-bg-suit">{c.suit}</div>
        </div>
      {/each}
    </div>

    <button class="btn-leave" onclick={() => connection.disconnect()}>Leave Game</button>
  </div>
</div>

<!-- Loser overlay -->
{#if showLoser}
  <div class="card-rain" aria-hidden="true">
    {#each rainCards as rc}
      <div
        class="rain-card"
        style="left:{rc.left}; animation-duration:{rc.duration}; animation-delay:{rc.delay}; font-size:{rc.size}; color:{rc.color};"
      >
        {rc.symbol}
      </div>
    {/each}
  </div>

  <div class="loser-overlay">
    <div class="loser-header">[ LOSER ]</div>
    <div class="loser-title">SHITHEAD</div>
    <div class="loser-name">Marco is the Shithead</div>
    <button class="btn-primary" onclick={() => { showLoser = false; rainCards = [] }}>
      Play Again
    </button>
  </div>
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
  }

  .opponent-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    animation: fadeDown 0.5s ease both;
  }

  .opponent-name-tag {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    background: rgba(0,0,0,0.4);
    padding: 0.2rem 0.7rem;
    border-radius: 4px;
  }

  .opp-row {
    display: flex;
    gap: 4px;
  }

  .no-opponents {
    font-family: 'Caveat', cursive;
    color: var(--muted);
    font-size: 1rem;
  }

  .opp-hand-count {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.6rem;
    color: var(--muted);
    letter-spacing: 0.05em;
  }

  /* ── Mini cards ── */
  .mini-card {
    width: 28px;
    height: 40px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 0.9rem;
    position: relative;
  }

  .mini-card.back {
    background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
    border: 1px solid rgba(255,255,255,0.15);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px,
      transparent 2px, transparent 8px
    );
  }

  .mini-card.front {
    background: var(--cream);
    border: 1px solid rgba(0,0,0,0.1);
    color: var(--red);
  }

  .mini-card.front.black { color: var(--ink); }

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
  }

  .card.back {
    background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
    border: 1px solid rgba(255,255,255,0.15);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px,
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
  .card.special { box-shadow: 3px 6px 16px rgba(0,0,0,0.5), 0 0 20px rgba(247,37,133,0.5); }

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

  /* Small cards */
  .card.sm {
    width: 56px;
    height: 80px;
    border-radius: 6px;
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

  .pile-wrap {
    text-align: center;
  }

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
  .draw-deck .card:nth-child(1) { transform: translate(-1px, 2px); }
  .draw-deck .card:nth-child(2) { transform: translate(0px, 1px); }
  .draw-deck .card:nth-child(3) { transform: translate(0px, 0px); }

  .discard-pile .card { position: absolute; }
  .discard-pile .card:nth-child(1) { transform: rotate(-4deg) translate(-3px, 2px); }
  .discard-pile .card:nth-child(2) { transform: rotate(2deg) translate(1px, -1px); }
  .discard-pile .card:nth-child(3) { transform: rotate(0deg); }

  /* ── Turn banner ── */
  .turn-banner {
    background: rgba(255,190,11,0.1);
    border: 1px solid rgba(255,190,11,0.3);
    border-radius: 8px;
    padding: 0.4rem 1.2rem;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.15em;
    color: var(--gold);
    animation: blink-border 2s ease-in-out infinite;
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
    width: 340px;
    justify-content: center;
    margin-bottom: 0.25rem;
  }

  .hand-card {
    position: absolute;
    bottom: 0;
    cursor: pointer;
  }

  .hand-card:hover {
    transform: translateY(-16px) rotate(0deg) !important;
    box-shadow: 4px 8px 24px rgba(0,0,0,0.7), 0 0 16px rgba(247,37,133,0.25) !important;
    z-index: 10 !important;
  }

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

  /* ── Loser overlay ── */
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
