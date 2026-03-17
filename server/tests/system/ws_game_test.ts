import { assertEquals, assertExists } from '@std/assert'
import { WSClient, withServer } from '../helpers.ts'
import type { ClientGameState } from '../../../shared/src/types.ts'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a room (Alice) and have Bob join. Returns clients and their IDs. */
async function setupRoom(wsUrl: string) {
  const alice = new WSClient(wsUrl)
  const bob = new WSClient(wsUrl)
  await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

  alice.send({ type: 'create_room', playerName: 'Alice' })
  const created = await alice.next() as { type: string; roomId: string; playerId: string }
  assertEquals(created.type, 'room_created')

  bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
  const joined = await bob.next() as { type: string; playerId: string }
  assertEquals(joined.type, 'joined')
  await alice.next() // player_joined notification

  return { alice, bob, roomId: created.roomId, aliceId: created.playerId, bobId: joined.playerId }
}

/** Start game and collect personalised game_started messages for both players. */
async function startGame(alice: WSClient, bob: WSClient) {
  alice.send({ type: 'start_game' })
  const [aliceMsg, bobMsg] = await Promise.all([alice.next(), bob.next()]) as { type: string; state: ClientGameState }[]
  assertEquals(aliceMsg.type, 'game_started')
  assertEquals(bobMsg.type, 'game_started')
  return { aliceState: aliceMsg.state, bobState: bobMsg.state }
}

/** Complete setup phase: both players choose their first 3 hand cards as face-up. */
async function completSetup(alice: WSClient, bob: WSClient, aliceState: ClientGameState, bobState: ClientGameState) {
  alice.send({ type: 'set_face_up', cardIds: aliceState.self.hand.slice(0, 3).map((c) => c.id) })
  bob.send({ type: 'set_face_up', cardIds: bobState.self.hand.slice(0, 3).map((c) => c.id) })

  // Each player receives face_up_set × 2 + game_state × 2 (order may vary)
  // Drain until we get game_state with phase=playing for both players
  let alicePlayState: ClientGameState | null = null
  let bobPlayState: ClientGameState | null = null

  for (let i = 0; i < 6; i++) {
    const [a, b] = await Promise.all([alice.next(), bob.next()]) as { type: string; state?: ClientGameState; allReady?: boolean }[]
    if (a.type === 'game_state' && a.state?.phase === 'playing') alicePlayState = a.state!
    if (b.type === 'game_state' && b.state?.phase === 'playing') bobPlayState = b.state!
    if (alicePlayState && bobPlayState) break
  }

  return { alicePlayState: alicePlayState!, bobPlayState: bobPlayState! }
}

/** Mirrors canPlayCard from game.ts so tests can determine valid plays. */
function isCardPlayable(rank: number, effectiveTop: { rank: number } | null, constraint: string): boolean {
  if (rank === 2 || rank === 3 || rank === 10) return true
  if (constraint === 'after2') return rank !== 7
  if (constraint === 'after7') return rank <= 7
  if (effectiveTop === null) return true
  if (rank === 7) return effectiveTop.rank >= 7
  return rank >= effectiveTop.rank
}

/** Choose the next action for the current player given their client state. */
function choosePlay(state: ClientGameState): { action: 'play'; cardIds: string[] } | { action: 'pick_up' } {
  const { effectiveTop, constraint } = state
  const playable = (rank: number) => isCardPlayable(rank, effectiveTop, constraint)

  // Hand phase
  if (state.self.hand.length > 0) {
    const card = state.self.hand.find((c) => playable(c.rank))
    if (card) return { action: 'play', cardIds: [card.id] }
    return { action: 'pick_up' }
  }

  // Face-up phase (only accessible once draw pile is exhausted)
  if (state.self.faceUp.length > 0 && state.drawPileCount === 0) {
    const card = state.self.faceUp.find((c) => playable(c.rank))
    if (card) return { action: 'play', cardIds: [card.id] }
    return { action: 'pick_up' }
  }

  // Face-down phase — reveal blindly; server handles unplayable cards gracefully
  if (state.self.faceDownIds.length > 0) {
    return { action: 'play', cardIds: [state.self.faceDownIds[0]] }
  }

  throw new Error('choosePlay: no valid action — player has no cards')
}

/**
 * Drive a 2-player game to completion by automatically making valid moves.
 * Both players always receive a `game_state` broadcast after each action,
 * so we can await both concurrently every round.
 */
async function playGameToCompletion(
  playerA: { ws: WSClient; id: string },
  playerB: { ws: WSClient; id: string },
  initialAState: ClientGameState,
  initialBState: ClientGameState,
): Promise<ClientGameState> {
  let stateA = initialAState
  let stateB = initialBState

  for (let round = 0; round < 1000; round++) {
    if (stateA.phase === 'finished') return stateA
    const currentId = stateA.currentPlayerId!
    const current = currentId === playerA.id ? playerA : playerB
    const currentState = currentId === playerA.id ? stateA : stateB

    const choice = choosePlay(currentState)
    if (choice.action === 'play') {
      current.ws.send({ type: 'play_card', cardIds: choice.cardIds })
    } else {
      current.ws.send({ type: 'pick_up_pile' })
    }

    // Server always broadcasts game_state to all players on success
    const [msgA, msgB] = await Promise.all([
      playerA.ws.next(3000),
      playerB.ws.next(3000),
    ]) as { type: string; state?: ClientGameState }[]
    if (msgA.type === 'game_state') stateA = msgA.state!
    if (msgB.type === 'game_state') stateB = msgB.state!
  }

  throw new Error('Game did not reach finished state within 1000 rounds')
}

// ── Tests ──────────────────────────────────────────────────────────────────

Deno.test('WS game: start_game requires >= 2 players', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const alice = new WSClient(wsUrl)
    await alice.waitForOpen()
    alice.send({ type: 'create_room', playerName: 'Alice' })
    await alice.next() // room_created
    alice.send({ type: 'start_game' })
    const msg = await alice.next() as { type: string }
    assertEquals(msg.type, 'error')
    alice.close()
  })
})

Deno.test('WS game: start_game deals cards to all players', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState, bobState } = await startGame(alice, bob)

    // Each player gets 6 cards in hand + 3 face-down (setup phase)
    assertEquals(aliceState.phase, 'setup')
    assertEquals(aliceState.self.hand.length, 6)
    assertEquals(aliceState.self.faceDownCount, 3)
    assertEquals(bobState.self.hand.length, 6)
    assertEquals(bobState.self.faceDownCount, 3)
    // Draw pile should be 52 - 18 = 34
    assertEquals(aliceState.drawPileCount, 34)

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: cannot start game twice', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    await startGame(alice, bob)

    alice.send({ type: 'start_game' })
    const msg = await alice.next() as { type: string }
    assertEquals(msg.type, 'error')

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: set_face_up moves cards to faceUp', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState } = await startGame(alice, bob)

    const chosen = aliceState.self.hand.slice(0, 3).map((c) => c.id)
    alice.send({ type: 'set_face_up', cardIds: chosen })

    // Drain messages until we see a game_state for Alice
    let updatedState: ClientGameState | null = null
    for (let i = 0; i < 4; i++) {
      const msg = await alice.next() as { type: string; state?: ClientGameState }
      if (msg.type === 'game_state') { updatedState = msg.state!; break }
    }

    assertExists(updatedState)
    assertEquals(updatedState!.self.faceUp.length, 3)
    assertEquals(updatedState!.self.hand.length, 3)
    assertEquals(updatedState!.self.faceDownCount, 3)

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: set_face_up with wrong count returns error', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState } = await startGame(alice, bob)

    alice.send({ type: 'set_face_up', cardIds: [aliceState.self.hand[0].id] }) // only 1
    const msg = await alice.next() as { type: string }
    assertEquals(msg.type, 'error')

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: play_card before game starts returns error', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)

    alice.send({ type: 'play_card', cardIds: ['fake'] })
    const msg = await alice.next() as { type: string }
    assertEquals(msg.type, 'error')

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: play_card in setup phase returns error', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState } = await startGame(alice, bob)

    alice.send({ type: 'play_card', cardIds: [aliceState.self.hand[0].id] })
    const msg = await alice.next() as { type: string }
    assertEquals(msg.type, 'error')

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: non-current player cannot play', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState, bobState } = await startGame(alice, bob)
    await completSetup(alice, bob, aliceState, bobState)

    // Bob tries to play when it is Alice's turn (player index 0)
    // We need to identify whose turn it is first
    // Since p1 (Alice) always starts, Bob should get 'Not your turn' error
    bob.send({ type: 'play_card', cardIds: [bobState.self.hand[0].id] })
    const msg = await bob.next() as { type: string }
    assertEquals(msg.type, 'error')

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: valid play updates game state for all players', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState, bobState } = await startGame(alice, bob)
    const { alicePlayState } = await completSetup(alice, bob, aliceState, bobState)

    // Avoid rank 10 (burns pile → 0 cards, Alice goes again) to keep assertions simple.
    const cardToPlay = alicePlayState.self.hand.find((c) => c.rank !== 10) ?? alicePlayState.self.hand[0]
    alice.send({ type: 'play_card', cardIds: [cardToPlay.id] })

    // Both players receive game_state
    const [aliceUpdate, bobUpdate] = await Promise.all([alice.next(), bob.next()]) as { type: string; state: ClientGameState }[]
    assertEquals(aliceUpdate.type, 'game_state')
    assertEquals(bobUpdate.type, 'game_state')

    // Pile has the played card (10 excluded above so no burn)
    assertEquals(aliceUpdate.state.discardPile.length, 1)
    // Both players see the same current player
    assertEquals(aliceUpdate.state.currentPlayerId, bobUpdate.state.currentPlayerId)

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: pick_up_pile works and advances turn', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState, bobState } = await startGame(alice, bob)
    const { alicePlayState } = await completSetup(alice, bob, aliceState, bobState)

    // Avoid rank 10 (burns pile) and rank 8 (in 2-player game, skips Bob so Alice goes again).
    // Both would prevent Bob from picking up on the next turn.
    const safeCard = alicePlayState.self.hand.find((c) => c.rank !== 10 && c.rank !== 8) ?? alicePlayState.self.hand[0]
    alice.send({ type: 'play_card', cardIds: [safeCard.id] })
    await Promise.all([alice.next(), bob.next()]) // game_state

    // Now it's Bob's turn; Bob picks up the pile
    bob.send({ type: 'pick_up_pile' })
    const [aliceUpd, bobUpd] = await Promise.all([alice.next(), bob.next()]) as { type: string; state: ClientGameState }[]
    assertEquals(aliceUpd.type, 'game_state')
    assertEquals(bobUpd.state.discardPile.length, 0)
    // Bob started with 3 hand cards and gained 1 from the pile = 4
    assertEquals(bobUpd.state.self.hand.length, 4)

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: pick_up_pile on empty pile returns error', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState, bobState } = await startGame(alice, bob)
    await completSetup(alice, bob, aliceState, bobState)

    // Alice tries to pick up an empty pile on her turn
    alice.send({ type: 'pick_up_pile' })
    const msg = await alice.next() as { type: string }
    assertEquals(msg.type, 'error')

    alice.close()
    bob.close()
  })
})

Deno.test('WS game: face_up_set broadcast includes allReady flag', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setupRoom(wsUrl)
    const { aliceState, bobState } = await startGame(alice, bob)

    alice.send({ type: 'set_face_up', cardIds: aliceState.self.hand.slice(0, 3).map((c) => c.id) })

    // Collect messages: Alice gets face_up_set + game_state, Bob gets face_up_set + game_state
    const aliceMsgs: { type: string; allReady?: boolean }[] = []
    for (let i = 0; i < 2; i++) aliceMsgs.push(await alice.next() as { type: string; allReady?: boolean })
    const bobMsgs: { type: string; allReady?: boolean }[] = []
    for (let i = 0; i < 2; i++) bobMsgs.push(await bob.next() as { type: string; allReady?: boolean })

    const aliceFaceUpSet = aliceMsgs.find((m) => m.type === 'face_up_set')
    assertExists(aliceFaceUpSet)
    // Not all ready yet (Bob hasn't set face-up)
    assertEquals(aliceFaceUpSet!.allReady, false)

    // Now Bob sets face-up — this should trigger allReady=true
    bob.send({ type: 'set_face_up', cardIds: bobState.self.hand.slice(0, 3).map((c) => c.id) })

    const bobMsg2s: { type: string; allReady?: boolean }[] = []
    for (let i = 0; i < 2; i++) bobMsg2s.push(await bob.next() as { type: string; allReady?: boolean })
    // Drain Alice's messages too
    for (let i = 0; i < 2; i++) await alice.next()

    const bobFaceUpSet2 = bobMsg2s.find((m) => m.type === 'face_up_set')
    assertExists(bobFaceUpSet2)
    assertEquals(bobFaceUpSet2!.allReady, true)

    alice.close()
    bob.close()
  })
})

// ── End-to-end game completion ──────────────────────────────────────────────

Deno.test('WS game: 2-player game plays to completion and reports a loser', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob, aliceId, bobId } = await setupRoom(wsUrl)
    const { aliceState, bobState } = await startGame(alice, bob)
    const { alicePlayState, bobPlayState } = await completSetup(alice, bob, aliceState, bobState)

    const finalState = await playGameToCompletion(
      { ws: alice, id: aliceId },
      { ws: bob, id: bobId },
      alicePlayState,
      bobPlayState,
    )

    assertEquals(finalState.phase, 'finished')
    assertExists(finalState.loser)
    assertEquals(finalState.loser === aliceId || finalState.loser === bobId, true)

    alice.close()
    bob.close()
  })
})
