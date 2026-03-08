<script lang="ts">
  import { connection } from '$lib/ws.svelte.ts'

  let copied = $state(false)

  async function copyCode() {
    if (!connection.roomId) return
    await navigator.clipboard.writeText(connection.roomId)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }
</script>

<div class="card">
  <div class="header">
    <h2>Lobby</h2>
    <button class="leave" onclick={() => connection.disconnect()}>Leave</button>
  </div>

  <section class="room-code">
    <p class="label">Room code</p>
    <div class="code-row">
      <span class="code">{connection.roomId}</span>
      <button class="copy" onclick={copyCode}>{copied ? '✓ Copied' : 'Copy'}</button>
    </div>
    <p class="hint">Share this code so others can join.</p>
  </section>

  {#if connection.error}
    <p class="error">{connection.error}</p>
  {/if}

  <section class="players">
    <p class="label">Players — {connection.players.length}</p>
    <ul>
      {#each connection.players as player (player.id)}
        <li class:me={player.id === connection.playerId}>
          <span class="player-name">{player.name}</span>
          <span class="badges">
            {#if player.id === connection.adminId}
              <span class="badge host">host</span>
            {/if}
            {#if player.id === connection.playerId}
              <span class="badge you">you</span>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  </section>

  {#if connection.isAdmin}
    <button
      class="start"
      onclick={() => connection.startGame()}
      disabled={connection.players.length < 2}
    >
      {connection.players.length < 2 ? 'Waiting for players…' : 'Start game'}
    </button>
  {:else}
    <p class="waiting">Waiting for the host to start the game…</p>
  {/if}
</div>

<style>
  .card {
    background: #1e2130;
    border: 1px solid #2d3148;
    border-radius: 12px;
    padding: 2.5rem;
    width: min(420px, 90vw);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .room-code {
    background: #0f1117;
    border: 1px solid #2d3148;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .code-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.4rem;
  }

  .code {
    font-family: monospace;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: #a5b4fc;
  }

  .copy {
    background: #1e2130;
    border: 1px solid #2d3148;
    border-radius: 5px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.3rem 0.65rem;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .copy:hover {
    border-color: #6366f1;
    color: #e2e8f0;
  }

  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: #475569;
  }

  .error {
    background: #3b1a1a;
    border: 1px solid #7f1d1d;
    color: #fca5a5;
    border-radius: 6px;
    padding: 0.6rem 0.9rem;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .players {
    margin-bottom: 1.5rem;
  }

  .label {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  li {
    background: #0f1117;
    border: 1px solid #2d3148;
    border-radius: 6px;
    padding: 0.6rem 0.9rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  li.me {
    border-color: #6366f1;
  }

  .player-name {
    flex: 1;
  }

  .badges {
    display: flex;
    gap: 0.35rem;
  }

  .badge {
    border-radius: 4px;
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
  }

  .badge.host {
    background: #1c1a12;
    color: #fbbf24;
    border: 1px solid #78350f;
  }

  .badge.you {
    background: #312e81;
    color: #a5b4fc;
  }

  .start {
    background: #16a34a;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    padding: 0.7rem;
    width: 100%;
    transition: background 0.15s;
  }

  .start:hover:not(:disabled) {
    background: #15803d;
  }

  .start:disabled {
    background: #1e2130;
    border: 1px solid #2d3148;
    color: #475569;
    cursor: not-allowed;
  }

  .waiting {
    text-align: center;
    color: #475569;
    font-size: 0.9rem;
    margin: 0;
    padding: 0.7rem;
  }

  .leave {
    background: none;
    border: 1px solid #2d3148;
    border-radius: 6px;
    color: #64748b;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0.35rem 0.75rem;
    transition: border-color 0.15s, color 0.15s;
  }

  .leave:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
</style>
