<script lang="ts">
  import { onMount } from 'svelte'
  import { connection } from '$lib/ws.svelte'
  import HomeView from './views/HomeView.svelte'
  import LobbyView from './views/LobbyView.svelte'
  import GameView from './views/GameView.svelte'
  import DemoView from './views/DemoView.svelte'
  import FeedbackButton from '$lib/FeedbackButton.svelte'
  import ChatPanel from '$lib/ChatPanel.svelte'

  const APP_VERSION = '0.0.1'
  const DEVELOPER_NAME = 'Noah'
  const GITHUB_URL = 'https://github.com/NoahZiltener'

  type Screen = 'home' | 'lobby' | 'game' | 'demo'
  let screen = $state<Screen>('home')

  onMount(() => {
    connection.tryRestoreSession()

    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.shiftKey && e.key === 'D' && screen === 'home' && !typing) screen = 'demo'
      if (e.key === 'Escape' && screen === 'demo') screen = 'home'
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  $effect(() => {
    if (!connection.playerId) {
      if (screen !== 'demo') screen = 'home'
    } else if (connection.gameStarted) {
      screen = 'game'
    } else {
      screen = 'lobby'
    }
  })
</script>

<nav class="nav-bar">
  <div class="nav-logo">SHIT<span>HEAD</span></div>
</nav>

{#if screen === 'game'}
  <GameView />
{:else if screen === 'lobby'}
  <LobbyView />
{:else if screen === 'demo'}
  <DemoView onBack={() => { screen = 'home' }} />
{:else}
  <HomeView notice={connection.error} />
{/if}

<FeedbackButton screen={screen === 'demo' ? 'home' : screen} />
{#if screen === 'lobby' || screen === 'game'}
  <ChatPanel />
{/if}

{#if screen === 'home' || screen === 'demo'}
  <footer class="app-footer">
    <div class="footer-content">
      <span class="version">v{APP_VERSION}</span>
      <span class="divider">•</span>
      <span class="developer">Made by <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">{DEVELOPER_NAME}</a></span>
    </div>
  </footer>
{/if}

<style>
  .nav-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    padding: calc(0.75rem + var(--safe-area-top)) 1.5rem var(--safe-area-right);
    background: rgba(14,14,24,0.8);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .nav-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.6rem;
    letter-spacing: 0.1em;
    color: var(--cream);
  }

  .nav-logo span {
    color: var(--neon);
  }

  .app-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.75rem 1.5rem calc(0.75rem + var(--safe-area-bottom));
    background: rgba(14,14,24,0.6);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255,255,255,0.05);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .footer-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .version {
    font-weight: 500;
    color: var(--muted);
  }

  .divider {
    opacity: 0.5;
  }

  .developer a {
    color: var(--neon);
    text-decoration: none;
    transition: opacity 0.2s;
  }

  .developer a:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .nav-bar {
      min-height: calc(4rem + var(--safe-area-top));
      padding-top: calc(0.45rem + var(--safe-area-top));
      padding-left: calc(1rem + var(--safe-area-left));
      padding-right: calc(7.2rem + var(--safe-area-right));
      padding-bottom: 0.55rem;
    }

    .nav-logo {
      font-size: 1.2rem;
    }

    .app-footer {
      padding-left: calc(1rem + var(--safe-area-left));
      padding-right: calc(1rem + var(--safe-area-right));
      font-size: 0.75rem;
    }
  }
</style>
