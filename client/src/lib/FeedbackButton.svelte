<script lang="ts">
  import { connection } from '$lib/ws.svelte'

  let { screen }: { screen: 'home' | 'lobby' | 'game' } = $props()

  let open = $state(false)
  let name = $state('')
  let message = $state('')
  let status = $state<'idle' | 'sending' | 'sent' | 'error'>('idle')

  function toggle() {
    open = !open
    if (!open) reset()
  }

  function reset() {
    status = 'idle'
    message = ''
    name = ''
  }

  async function submit() {
    if (!message.trim() || status === 'sending') return
    status = 'sending'
    try {
      const clientInfo = {
        userAgent: navigator.userAgent,
        screen: `${window.screen.width}×${window.screen.height}`,
        currentScreen: screen,
        roomCode: connection.roomId ?? null,
        timestamp: new Date().toISOString(),
      }
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: message.trim(), clientInfo }),
      })
      status = res.ok ? 'sent' : 'error'
    } catch {
      status = 'error'
    }
  }
</script>

<button class="fab" onclick={toggle} aria-label="Send feedback" title="Send feedback">
  {#if open}
    ✕
  {:else}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  {/if}
</button>

{#if open}
  <div class="panel">
    <h3>Send Feedback</h3>

    {#if status === 'sent'}
      <p class="success">Thanks for your feedback!</p>
      <button class="btn-primary" onclick={reset}>Send more</button>
    {:else}
      {#if status === 'error'}
        <p class="error-msg">Something went wrong. Please try again.</p>
      {/if}

      <div class="field">
        <label for="fb-name">Name (optional)</label>
        <input id="fb-name" type="text" placeholder="Your name..." bind:value={name} maxlength="40" />
      </div>

      <div class="field">
        <label for="fb-message">Message</label>
        <textarea id="fb-message" placeholder="What's on your mind?" bind:value={message} maxlength="1000" rows="4"></textarea>
      </div>

      <button
        class="btn-primary"
        onclick={submit}
        disabled={!message.trim() || status === 'sending'}
      >
        {status === 'sending' ? 'Sending...' : 'Send'}
      </button>
    {/if}
  </div>
{/if}

<style>
  .fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 200;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--neon);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    box-shadow: 0 4px 20px rgba(247, 37, 133, 0.45);
    transition: transform 0.15s, box-shadow 0.2s;
  }

  .fab:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(247, 37, 133, 0.6);
  }

  .panel {
    position: fixed;
    bottom: 5.5rem;
    right: 1.5rem;
    z-index: 200;
    width: 300px;
    background: rgba(14, 14, 24, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 1.5rem;
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.2s ease both;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  h3 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.3rem;
    letter-spacing: 0.1em;
    color: var(--cream);
    margin: 0 0 1.2rem;
  }

  .field {
    margin-bottom: 0.9rem;
  }

  .field label {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.35rem;
  }

  .field input,
  .field textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--cream);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    padding: 0.6rem 0.8rem;
    outline: none;
    resize: vertical;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }

  .field input:focus,
  .field textarea:focus {
    border-color: var(--neon);
    box-shadow: 0 0 0 3px rgba(247, 37, 133, 0.15);
  }

  .btn-primary {
    width: 100%;
    background: var(--neon);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem;
    letter-spacing: 0.1em;
    padding: 0.65rem;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 3px 14px rgba(247, 37, 133, 0.35);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(247, 37, 133, 0.5);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .success {
    color: #86efac;
    font-size: 0.95rem;
    margin-bottom: 1rem;
  }

  .error-msg {
    background: rgba(230, 57, 70, 0.1);
    border: 1px solid rgba(230, 57, 70, 0.3);
    border-radius: 6px;
    color: #fca5a5;
    font-size: 0.82rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.9rem;
  }
</style>
