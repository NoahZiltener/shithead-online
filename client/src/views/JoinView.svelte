<script lang="ts">
  import { connection } from '$lib/ws.svelte.ts'

  let { goBack }: { goBack: () => void } = $props()
  let name = $state('')
  let roomId = $state('')

  function join() {
    if (name.trim() && roomId.trim()) connection.connect(name.trim(), roomId.trim().toUpperCase())
  }
</script>

<div class="card">
  <button class="back" onclick={goBack}>← Back</button>
  <h2>Join room</h2>

  {#if connection.error}
    <p class="error">{connection.error}</p>
  {/if}

  <form onsubmit={(e) => { e.preventDefault(); join() }}>
    <label>
      Your name
      <input bind:value={name} placeholder="Alice" maxlength="20" required />
    </label>
    <label>
      Room code
      <input bind:value={roomId} placeholder="ABC123" maxlength="32" required
        style="text-transform: uppercase; letter-spacing: 0.1em;" />
    </label>
    <button type="submit" disabled={connection.status === 'connecting'}>
      {connection.status === 'connecting' ? 'Joining…' : 'Join room'}
    </button>
  </form>
</div>

<style>
  .card {
    background: #1e2130;
    border: 1px solid #2d3148;
    border-radius: 12px;
    padding: 2.5rem;
    width: min(420px, 90vw);
  }

  .back {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
    margin-bottom: 1.25rem;
    transition: color 0.15s;
  }

  .back:hover {
    color: #e2e8f0;
  }

  h2 {
    margin: 0 0 1.75rem;
    font-size: 1.5rem;
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

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  input {
    background: #0f1117;
    border: 1px solid #2d3148;
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 1rem;
    padding: 0.6rem 0.75rem;
    outline: none;
    transition: border-color 0.15s;
  }

  input:focus {
    border-color: #6366f1;
  }

  button[type='submit'] {
    background: #6366f1;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    margin-top: 0.5rem;
    padding: 0.7rem;
    transition: background 0.15s;
  }

  button[type='submit']:hover:not(:disabled) {
    background: #4f46e5;
  }

  button[type='submit']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
