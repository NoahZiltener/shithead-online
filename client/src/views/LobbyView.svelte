<script lang="ts">
  import { connection } from '$lib/ws.svelte'
  import type { BotDifficulty } from '$shared/types.ts'

  let copied = $state(false)
  let botDifficulty = $state<BotDifficulty>('medium')

  async function copyCode() {
    if (!connection.roomId) return
    await navigator.clipboard.writeText(connection.roomId)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  function kickPlayer(id: string) {
    connection.kickPlayer(id)
  }

  function addBot() {
    connection.addBot(botDifficulty)
  }

  function removeBot(id: string) {
    connection.removeBot(id)
  }

  const emptySlots = $derived(
    Math.max(0, connection.maxPlayers - connection.players.length)
  )

  const avatarColors = ['#f72585', '#7209b7', '#3a86ff', '#06d6a0', '#fb5607', '#ffbe0b']

  function avatarColor(index: number): string {
    return avatarColors[index % avatarColors.length]
  }
</script>

<div class="waiting-bg"></div>

<div class="waiting-wrap">
  <!-- Header: title + room code -->
  <div class="w-header">
    <h2 class="w-title">Waiting Room</h2>
    <div class="room-code-block">
      <div class="room-code-label-col">
        <span class="room-code-label">Room Code</span>
        <span class="room-code-val">{connection.roomId}</span>
      </div>
      <button
        class="copy-btn"
        class:copied
        onclick={copyCode}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  </div>

  <!-- Two-column body -->
  <div class="w-body">

    <!-- Left: Players panel -->
    <div class="players-panel">
      <div class="panel-head">
        <span class="panel-head-title">Players</span>
        <span class="player-count-badge">{connection.players.length} / {connection.maxPlayers}</span>
      </div>

        {#each connection.players as player, i (player.id)}
          {@const isHost = player.id === connection.adminId}
          {@const isMe = player.id === connection.playerId}
          {@const isBot = player.isBot === true}
          <div class="player-row">
            <div
              class="p-avatar"
              class:is-host={isHost && !isMe}
              class:is-you={isMe}
            style={!isHost && !isMe ? `border-color: ${avatarColor(i)}` : ''}
          >
            {player.name[0].toUpperCase()}
          </div>
            <div class="p-info">
              <div class="p-name" class:is-you={isMe}>{player.name}</div>
              <div class="p-badges">
                {#if isHost}<span class="badge badge-host">Host</span>{/if}
                {#if isMe}<span class="badge badge-you">You</span>{/if}
                {#if isBot}<span class="badge badge-bot">Bot</span>{/if}
                {#if isBot && player.botDifficulty}<span class="badge badge-bot-difficulty">{player.botDifficulty}</span>{/if}
              </div>
            </div>
            {#if connection.isAdmin && !isMe && !isBot}
              <button class="kick-btn kick" title="Kick {player.name}" onclick={() => kickPlayer(player.id)}>Kick</button>
            {:else if connection.isAdmin && isBot}
              <button class="kick-btn remove-bot" title="Remove {player.name}" onclick={() => removeBot(player.id)}>Remove</button>
            {/if}
          </div>
        {/each}

      {#each { length: emptySlots } as _, i}
        <div class="player-row">
          <div class="p-avatar empty-slot">+</div>
          <div class="p-info">
            <div class="p-name empty-slot">Waiting for player...</div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Right: Settings + Start -->
    <div class="right-col">

      <!-- Game Settings -->
      <div class="settings-panel">
        <div class="panel-head">
          <span class="panel-head-title">Game Settings</span>
          <span class="host-only-label">Host only</span>
        </div>

        <div class="setting-row">
          <div class="setting-label">Deck Mode</div>
          {#if connection.isAdmin}
            <div class="deck-toggle">
              <button
                class="deck-option"
                class:selected={connection.gameMode === 'normal'}
                onclick={() => connection.setGameMode('normal')}
              >
                <div class="selected-dot"></div>
                <span class="deck-option-name">Normal</span>
                <span class="deck-option-desc">52 cards<br>2–5 players</span>
              </button>
              <button
                class="deck-option"
                class:selected={connection.gameMode === 'double_deck'}
                onclick={() => connection.setGameMode('double_deck')}
              >
                <div class="selected-dot"></div>
                <span class="deck-option-name">Double Deck</span>
                <span class="deck-option-desc">104 cards<br>2–10 players</span>
              </button>
            </div>
          {:else}
            <p class="mode-display">
              {connection.gameMode === 'normal' ? 'Normal' : 'Double Deck'}
            </p>
          {/if}
        </div>

        <div class="setting-note">Changes can only be made before the game starts.</div>

        <div class="setting-row">
          <div class="setting-label">Bots</div>
          {#if connection.isAdmin}
            <div class="bot-controls">
              <select bind:value={botDifficulty} class="bot-difficulty-select">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <button class="bot-add-btn" onclick={addBot} disabled={connection.players.length >= connection.maxPlayers}>Add Bot</button>
            </div>
          {:else}
            <p class="mode-display">Host controls bot setup</p>
          {/if}
        </div>
      </div>

      <!-- Start panel -->
      <div class="start-panel">
        {#if connection.error}
          <div class="error-msg">{connection.error}</div>
        {/if}

        <div class="start-status">
          {connection.players.length} of {connection.maxPlayers} players in room
        </div>

        {#if connection.isAdmin}
          <button
            class="btn-start"
            onclick={() => connection.startGame()}
            disabled={connection.players.length < 2}
          >
            {connection.players.length < 2 ? 'Need 2+ Players' : 'Start Game'}
          </button>
        {:else}
          <div class="waiting-msg">Waiting for host to start...</div>
        {/if}

        <button class="btn-leave" onclick={() => connection.disconnect()}>Leave Room</button>
      </div>

    </div>
  </div>
</div>

<style>
  .waiting-bg {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(22,64,42,0.4) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(247,37,133,0.05) 0%, transparent 60%);
    z-index: 0;
  }

  .waiting-wrap {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: calc(6rem + var(--safe-area-top)) 1.5rem calc(2rem + var(--safe-area-bottom));
  }

  /* ── Header ── */
  .w-header {
    width: 100%;
    max-width: 860px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
    animation: fadeUp 0.5s ease both;
  }

  .w-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.2em;
    color: var(--muted);
    margin: 0;
  }

  .room-code-block {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255,190,11,0.07);
    border: 1px solid rgba(255,190,11,0.2);
    border-radius: 10px;
    padding: 0.5rem 1rem 0.5rem 1.25rem;
  }

  .room-code-label-col {
    display: flex;
    flex-direction: column;
  }

  .room-code-label {
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    font-family: 'DM Sans', sans-serif;
  }

  .room-code-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.2rem;
    letter-spacing: 0.3em;
    color: var(--gold);
    text-shadow: 0 0 20px rgba(255,190,11,0.4);
    line-height: 1;
  }

  .copy-btn {
    background: rgba(255,190,11,0.12);
    border: 1px solid rgba(255,190,11,0.25);
    color: var(--gold);
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
    white-space: nowrap;
    min-height: 36px;
  }

  .copy-btn:active { background: rgba(255,190,11,0.22); border-color: rgba(255,190,11,0.5); }
  .copy-btn.copied { color: #4ade80; border-color: rgba(74,222,128,0.4); background: rgba(74,222,128,0.08); }

  /* ── Layout ── */
  .w-body {
    width: 100%;
    max-width: 1200px;
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.25rem;
    align-items: start;
    animation: fadeUp 0.5s 0.1s ease both;
  }

  @media (max-width: 1024px) {
    .w-body { grid-template-columns: 1fr 1fr; }
  }

  @media (max-width: 640px) {
    .waiting-wrap {
      padding: calc(4.75rem + var(--safe-area-top)) 1rem calc(7rem + var(--safe-area-bottom));
    }

    .w-header {
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .w-title {
      font-size: 1rem;
    }

    .room-code-val {
      font-size: 1.8rem;
    }

    .w-body { 
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  /* ── Players panel ── */
  .players-panel {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    overflow: hidden;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .panel-head-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1rem;
    letter-spacing: 0.15em;
    color: var(--muted);
  }

  .player-count-badge {
    font-size: 0.75rem;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 0.15rem 0.6rem;
    color: var(--muted);
    font-family: 'DM Sans', sans-serif;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.15s;
    min-height: 64px;
  }

  .player-row:last-child { border-bottom: none; }
  .player-row:active { background: rgba(255,255,255,0.02); }

  .p-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0,0,0,0.4);
    border: 2px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.1rem;
    color: var(--cream);
    flex-shrink: 0;
    transition: border-color 0.2s;
  }

  .p-avatar.is-you {
    border-color: var(--neon);
    box-shadow: 0 0 10px rgba(247,37,133,0.35);
  }

  .p-avatar.is-host {
    border-color: var(--gold);
    box-shadow: 0 0 10px rgba(255,190,11,0.3);
  }

  .p-avatar.empty-slot {
    border-style: dashed;
    border-color: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.12);
    font-size: 1.3rem;
  }

  .p-info { flex: 1; min-width: 0; }

  .p-name {
    font-size: 0.95rem;
    color: var(--text);
    font-weight: 500;
    line-height: 1.2;
  }

  .p-name.is-you { color: var(--neon); }
  .p-name.empty-slot { color: rgba(255,255,255,0.2); font-style: italic; font-weight: 300; font-size: 0.85rem; }

  .p-badges {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.2rem;
  }

  .badge {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.1rem 0.45rem;
    border-radius: 3px;
    font-weight: 600;
  }

  .badge-host { background: rgba(255,190,11,0.15); color: var(--gold); border: 1px solid rgba(255,190,11,0.25); }
  .badge-you  { background: rgba(247,37,133,0.12); color: var(--neon); border: 1px solid rgba(247,37,133,0.25); }
  .badge-bot  { background: rgba(58,134,255,0.14); color: #93c5fd; border: 1px solid rgba(58,134,255,0.3); }
  .badge-bot-difficulty { background: rgba(255,255,255,0.08); color: var(--muted); border: 1px solid rgba(255,255,255,0.15); text-transform: capitalize; }

  .kick-btn {
    background: none;
    border: 1px solid rgba(230,57,70,0.25);
    color: rgba(230,57,70,0.5);
    border-radius: 5px;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
    flex-shrink: 0;
    min-height: 32px;
  }

  .kick-btn:active {
    border-color: var(--red);
    color: var(--red);
    background: rgba(230,57,70,0.08);
  }

  .kick-btn.remove-bot {
    border-color: rgba(58,134,255,0.3);
    color: rgba(147,197,253,0.8);
  }

  .kick-btn.remove-bot:active {
    border-color: #3b82f6;
    color: #93c5fd;
    background: rgba(58,134,255,0.12);
  }

  /* ── Right column ── */
  .right-col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ── Settings panel ── */
  .settings-panel {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    overflow: hidden;
  }

  .host-only-label {
    font-size: 0.7rem;
    color: var(--muted);
    font-family: 'Caveat', cursive;
  }

  .setting-row {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .setting-label {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }

  .deck-toggle {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .deck-option {
    flex: 1;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 0.7rem 0.5rem;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
    font-family: inherit;
    min-height: 44px;
    min-width: 80px;
  }

  .deck-option:disabled {
    cursor: default;
  }

  .deck-option.selected {
    border-color: var(--neon);
    background: rgba(247,37,133,0.08);
  }

  .deck-option:active {
    border-color: var(--neon);
    background: rgba(247,37,133,0.08);
  }

  .deck-option-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1rem;
    letter-spacing: 0.1em;
    color: var(--text);
    display: block;
    margin-bottom: 0.15rem;
  }

  .deck-option-desc {
    font-size: 0.7rem;
    color: var(--muted);
    line-height: 1.3;
  }

  .deck-option.selected .deck-option-name { color: var(--neon); }

  .selected-dot {
    display: none;
    width: 6px; height: 6px;
    background: var(--neon);
    border-radius: 50%;
    position: absolute;
    top: 8px; right: 8px;
    box-shadow: 0 0 6px var(--neon);
  }

  .deck-option.selected .selected-dot { display: block; }

  .setting-note {
    font-family: 'Caveat', cursive;
    font-size: 0.85rem;
    color: rgba(255,255,255,0.2);
    padding: 0.6rem 1.25rem;
    font-style: italic;
  }

  .bot-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .bot-difficulty-select {
    flex: 1;
    min-height: 36px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    padding: 0 0.6rem;
    text-transform: capitalize;
  }

  .bot-add-btn {
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(58,134,255,0.4);
    background: rgba(58,134,255,0.14);
    color: #93c5fd;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    padding: 0 0.7rem;
    cursor: pointer;
  }

  .bot-add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Start panel ── */
  .start-panel {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 1.25rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .error-msg {
    background: rgba(230,57,70,0.1);
    border: 1px solid rgba(230,57,70,0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
  }

  .start-status {
    font-family: 'Caveat', cursive;
    font-size: 1rem;
    color: var(--muted);
  }

  .btn-start {
    width: 100%;
    background: var(--gold);
    color: var(--ink);
    border: none;
    border-radius: 10px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.6rem;
    letter-spacing: 0.15em;
    padding: 0.8rem;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 24px rgba(255,190,11,0.4);
    animation: pulse-gold 2s ease-in-out infinite;
    min-height: 52px;
  }

  .btn-start:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 4px 24px rgba(255,190,11,0.4);
    animation: none;
  }

  .btn-start:disabled {
    background: rgba(255,255,255,0.06);
    color: var(--muted);
    cursor: not-allowed;
    animation: none;
    box-shadow: none;
  }

  .waiting-msg {
    font-family: 'Caveat', cursive;
    font-size: 0.95rem;
    color: var(--muted);
    padding: 0.5rem 0;
  }

  .btn-leave {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: var(--muted);
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    padding: 0.4rem 1rem;
    transition: border-color 0.2s, color 0.2s;
    min-height: 40px;
  }

  .btn-leave:active {
    border-color: var(--red);
    color: var(--red);
  }

  @media (max-width: 640px) {
    .player-row {
      padding: 0.75rem 1rem;
      min-height: 56px;
    }

    .p-avatar {
      width: 36px;
      height: 36px;
      font-size: 0.95rem;
    }

    .p-name {
      font-size: 0.9rem;
    }

    .kick-btn {
      min-height: 36px;
      font-size: 0.65rem;
      padding: 0.2rem 0.5rem;
    }

    .deck-option {
      min-height: 40px;
      padding: 0.5rem 0.4rem;
      font-size: 0.9rem;
    }

    .deck-option-name {
      font-size: 0.85rem;
      margin-bottom: 0.1rem;
    }

    .deck-option-desc {
      font-size: 0.65rem;
    }

    .btn-start {
      font-size: 1.3rem;
      padding: 0.65rem;
      min-height: 48px;
    }

    .right-col {
      gap: 1rem;
    }

    .settings-panel, .start-panel {
      border-radius: 10px;
      padding: 1rem;
    }

    .panel-head {
      padding: 0.85rem 1rem;
    }

    .setting-row {
      padding: 0.85rem 1rem;
    }

    .btn-leave {
      width: 100%;
      font-size: 0.75rem;
      padding: 0.35rem 0.75rem;
    }
  }
</style>
