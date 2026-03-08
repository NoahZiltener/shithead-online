<script lang="ts">
  let { onCreate, onJoin }: { onCreate: () => void; onJoin: () => void } = $props()
</script>

<div class="card">
  <h1>Shithead</h1>
  <p class="subtitle">The card game, online.</p>

  <div class="actions">
    <button class="primary" onclick={onCreate}>Create room</button>
    <button class="secondary" onclick={onJoin}>Join room</button>
  </div>
</div>

<style>
  .card {
    background: #1e2130;
    border: 1px solid #2d3148;
    border-radius: 12px;
    padding: 2.5rem;
    width: min(420px, 90vw);
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 2rem;
    letter-spacing: -0.5px;
  }

  .subtitle {
    margin: 0 0 2.5rem;
    color: #64748b;
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  button {
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    padding: 0.75rem;
    transition: background 0.15s;
    width: 100%;
  }

  .primary {
    background: #6366f1;
    color: #fff;
  }

  .primary:hover {
    background: #4f46e5;
  }

  .secondary {
    background: #1e2130;
    border: 1px solid #2d3148;
    color: #94a3b8;
  }

  .secondary:hover {
    border-color: #6366f1;
    color: #e2e8f0;
  }
</style>
