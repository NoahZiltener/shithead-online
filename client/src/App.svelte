<script lang="ts">
  import { onMount } from 'svelte'
  import { connection } from '$lib/ws.svelte'
  import HomeView from './views/HomeView.svelte'
  import LobbyView from './views/LobbyView.svelte'
  import GameView from './views/GameView.svelte'

  type Screen = 'home' | 'lobby' | 'game'
  let screen = $state<Screen>('home')

  onMount(() => { connection.tryRestoreSession() })

  $effect(() => {
    if (!connection.playerId) {
      screen = 'home'
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
{:else}
  <HomeView notice={connection.error} />
{/if}

<style>
  .nav-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
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
</style>
