<script lang="ts">
  import { connection } from '$lib/ws.svelte.ts'

  let { notice = null }: { notice?: string | null } = $props()

  let name = $state('')
  let roomCode = $state('')

  function join() {
    if (name.trim() && roomCode.trim()) {
      connection.connect(name.trim(), roomCode.trim().toUpperCase())
    }
  }

  function create() {
    if (name.trim()) {
      connection.createRoom(name.trim())
    }
  }
</script>

<div class="lobby-bg"></div>

<div class="lobby-wrap">
  <div class="logo">
    <div class="logo-title">SHIT<span>HEAD</span></div>
    <div class="logo-sub">The card game. No mercy.</div>
  </div>

  <div class="lobby-card">
    {#if notice}
      <div class="notice">{notice}</div>
    {/if}

    <h2>Join a Game</h2>

    <div class="input-group">
      <label for="name">Your Name</label>
      <input id="name" type="text" placeholder="Enter your name..." bind:value={name} maxlength="20" />
    </div>

    <div class="input-group">
      <label for="room">Room Code</label>
      <input id="room" type="text" placeholder="e.g. K47X" bind:value={roomCode} class="room-input" maxlength="32" />
    </div>

    <button
      class="btn-primary"
      onclick={join}
      disabled={!name.trim() || !roomCode.trim() || connection.status === 'connecting'}
    >
      {connection.status === 'connecting' ? 'Connecting...' : 'Join Room'}
    </button>

    <div class="divider">or</div>

    <button
      class="btn-secondary"
      onclick={create}
      disabled={!name.trim() || connection.status === 'connecting'}
    >
      Create New Room
    </button>
  </div>
</div>

<style>
  .lobby-bg {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 100%, rgba(22,64,42,0.6) 0%, transparent 70%),
      radial-gradient(ellipse 40% 40% at 20% 20%, rgba(247,37,133,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 40% 40% at 80% 80%, rgba(114,9,183,0.1) 0%, transparent 60%);
    z-index: 0;
  }

  .lobby-wrap {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5rem 2rem 2rem;
  }

  .logo {
    text-align: center;
    margin-bottom: 3rem;
    animation: fadeUp 0.8s ease both;
  }

  .logo-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(5rem, 15vw, 11rem);
    line-height: 0.9;
    letter-spacing: 0.05em;
    color: var(--cream);
    text-shadow:
      0 0 40px rgba(247,37,133,0.4),
      0 0 80px rgba(247,37,133,0.15),
      4px 4px 0 rgba(0,0,0,0.5);
  }

  .logo-title span {
    color: var(--neon);
    text-shadow:
      0 0 20px var(--neon),
      0 0 60px rgba(247,37,133,0.5);
  }

  .logo-sub {
    font-family: 'Caveat', cursive;
    font-size: 1.4rem;
    color: var(--muted);
    letter-spacing: 0.1em;
    margin-top: 0.5rem;
  }

  .lobby-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 2.5rem 3rem;
    width: 100%;
    max-width: 420px;
    backdrop-filter: blur(12px);
    animation: fadeUp 0.8s 0.2s ease both;
  }

  .notice {
    background: rgba(230,57,70,0.1);
    border: 1px solid rgba(230,57,70,0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.6rem;
    letter-spacing: 0.1em;
    margin: 0 0 1.5rem;
    color: var(--text);
  }

  .input-group {
    margin-bottom: 1rem;
  }

  .input-group label {
    display: block;
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.4rem;
  }

  .input-group input {
    width: 100%;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: var(--cream);
    font-family: 'DM Sans', sans-serif;
    font-size: 1rem;
    padding: 0.75rem 1rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input-group input:focus {
    border-color: var(--neon);
    box-shadow: 0 0 0 3px rgba(247,37,133,0.15);
  }

  .room-input {
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .btn-primary {
    width: 100%;
    background: var(--neon);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.4rem;
    letter-spacing: 0.12em;
    padding: 0.85rem;
    cursor: pointer;
    margin-top: 1.5rem;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(247,37,133,0.35);
    display: block;
  }

  .btn-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
    pointer-events: none;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(247,37,133,0.5);
  }

  .btn-primary:active:not(:disabled) { transform: translateY(0); }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.5rem 0;
    color: var(--muted);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
  }

  .divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.08);
  }

  .btn-secondary {
    width: 100%;
    background: transparent;
    color: var(--text);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem;
    letter-spacing: 0.1em;
    padding: 0.75rem;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    display: block;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.04);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
