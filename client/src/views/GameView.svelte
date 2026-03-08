<script lang="ts">
  import { connection } from '$lib/ws.svelte.ts'
</script>

<div class="card">
  <h2>Game</h2>
  <p class="placeholder">Game board coming soon.</p>
  <p class="players-info">{connection.players.length} players in this game.</p>
  <button onclick={() => connection.disconnect()}>Leave game</button>
</div>

<style>
  .card {
    background: #1e2130;
    border: 1px solid #2d3148;
    border-radius: 12px;
    padding: 2.5rem;
    width: min(420px, 90vw);
    text-align: center;
  }

  h2 {
    margin: 0 0 1rem;
  }

  .placeholder {
    color: #64748b;
    margin: 0 0 0.5rem;
  }

  .players-info {
    color: #475569;
    font-size: 0.85rem;
    margin: 0 0 2rem;
  }

  button {
    background: none;
    border: 1px solid #2d3148;
    border-radius: 6px;
    color: #64748b;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
    transition: border-color 0.15s, color 0.15s;
  }

  button:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
</style>
