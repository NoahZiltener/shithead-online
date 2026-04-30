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
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 6c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/>
      <path d="M9 18h6"/>
      <path d="M10 22h4"/>
    </svg>
  {/if}
</button>

{#if open}
  <button class="panel-backdrop" onclick={toggle} aria-label="Close feedback panel"></button>
  <div class="panel">
    <div class="panel-header">
      <h3>Send Feedback</h3>
      <button class="close-btn" onclick={toggle} aria-label="Close feedback">✕</button>
    </div>

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
    bottom: calc(2.25rem + var(--safe-area-bottom));
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

  .fab:active {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(247, 37, 133, 0.6);
  }

  .panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 280;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    -webkit-tap-highlight-color: transparent;
  }

  .panel {
    position: fixed;
    bottom: 5.5rem;
    right: 1.5rem;
    z-index: 300;
    width: 300px;
    background: rgba(14, 14, 24, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 1.5rem;
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.2s ease both;
    max-height: calc(100vh - 10rem);
    overflow-y: auto;
    margin-right: var(--safe-area-right);
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
    margin: 0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.2rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--cream);
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    min-height: 40px;
    transition: color 0.2s;
  }

  .close-btn:active {
    color: var(--neon);
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
    font-size: 1rem;
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
    min-height: 44px;
  }

  .btn-primary:active:not(:disabled) {
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

  @media (max-width: 640px) {
    .fab {
      width: 2.5rem !important;
      height: 2.5rem !important;
      font-size: 0.95rem !important;
      top: calc(0.75rem + var(--safe-area-top)) !important;
      bottom: auto !important;
      right: max(1rem, calc(1rem + var(--safe-area-right))) !important;
      left: auto !important;
    }

    .panel {
      position: fixed !important;
      width: calc(100vw - 2rem) !important;
      max-width: 360px !important;
      height: auto !important;
      max-height: 75vh !important;
      top: 50% !important;
      left: 50% !important;
      right: auto !important;
      bottom: auto !important;
      transform: translate(-50%, -50%) !important;
      margin-right: 0 !important;
      margin-left: 0 !important;
      border-radius: 16px !important;
      padding-bottom: 1.25rem !important;
      animation: none !important;
    }

    h3 {
      font-size: 1.1rem;
    }

    .field label {
      font-size: 0.65rem;
    }

    .field input,
    .field textarea {
      font-size: 16px;
      padding: 0.5rem 0.6rem;
    }

    .btn-primary {
      font-size: 1rem;
      padding: 0.55rem;
    }
  }
</style>
