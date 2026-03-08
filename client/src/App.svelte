<script lang="ts">
  import { connection } from '$lib/ws.svelte.ts'
  import HomeView from './views/HomeView.svelte'
  import CreateRoomView from './views/CreateRoomView.svelte'
  import JoinView from './views/JoinView.svelte'
  import LobbyView from './views/LobbyView.svelte'
  import GameView from './views/GameView.svelte'

  type Screen = 'home' | 'create' | 'join' | 'lobby' | 'game'
  let screen = $state<Screen>('home')

  $effect(() => {
    if (connection.playerId) screen = 'lobby'
  })

  $effect(() => {
    if (connection.gameStarted) screen = 'game'
  })

  $effect(() => {
    if (!connection.playerId && screen === 'lobby') screen = 'home'
  })
</script>

{#if screen === 'game'}
  <GameView />
{:else if screen === 'lobby'}
  <LobbyView />
{:else if screen === 'create'}
  <CreateRoomView goBack={() => (screen = 'home')} />
{:else if screen === 'join'}
  <JoinView goBack={() => (screen = 'home')} />
{:else}
  <HomeView onCreate={() => (screen = 'create')} onJoin={() => (screen = 'join')} />
{/if}
