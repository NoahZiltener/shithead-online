import { assertEquals, assertExists } from '@std/assert'
import { WSClient, withServer } from '../helpers.ts'
import type { ClientGameState } from '../../../shared/src/types.ts'

// ── Setup helpers ───────────────────────────────────────────────────────────

async function setup2(wsUrl: string) {
  const alice = new WSClient(wsUrl)
  const bob = new WSClient(wsUrl)
  await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

  alice.send({ type: 'create_room', playerName: 'Alice' })
  const created = await alice.next() as { type: string; roomId: string; playerId: string }
  assertEquals(created.type, 'room_created')

  bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
  const joined = await bob.next() as { type: string; playerId: string }
  assertEquals(joined.type, 'joined')
  await alice.next() // player_joined

  return { alice, bob, roomId: created.roomId, aliceId: created.playerId, bobId: joined.playerId }
}

async function setup3(wsUrl: string) {
  const { alice, bob, roomId, aliceId, bobId } = await setup2(wsUrl)
  const carol = new WSClient(wsUrl)
  await carol.waitForOpen()
  carol.send({ type: 'join', roomId, playerName: 'Carol' })
  const carolJoined = await carol.next() as { type: string; playerId: string }
  assertEquals(carolJoined.type, 'joined')
  await alice.next() // player_joined carol
  await bob.next()   // player_joined carol
  return { alice, bob, carol, roomId, aliceId, bobId, carolId: carolJoined.playerId }
}

async function startGame2(alice: WSClient, bob: WSClient) {
  alice.send({ type: 'start_game' })
  const [aMsg, bMsg] = await Promise.all([alice.next(), bob.next()]) as { type: string; state: ClientGameState }[]
  assertEquals(aMsg.type, 'game_started')
  return { aliceState: aMsg.state, bobState: bMsg.state }
}

async function startGame3(alice: WSClient, bob: WSClient, carol: WSClient) {
  alice.send({ type: 'start_game' })
  const [aMsg, bMsg, cMsg] = await Promise.all([alice.next(), bob.next(), carol.next()]) as { type: string; state: ClientGameState }[]
  assertEquals(aMsg.type, 'game_started')
  return { aliceState: aMsg.state, bobState: bMsg.state, carolState: cMsg.state }
}

async function completeSetup2(
  alice: WSClient, bob: WSClient,
  aliceState: ClientGameState, bobState: ClientGameState,
) {
  alice.send({ type: 'set_face_up', cardIds: aliceState.self.hand.slice(0, 3).map(c => c.id) })
  bob.send({ type: 'set_face_up', cardIds: bobState.self.hand.slice(0, 3).map(c => c.id) })
  let alicePlay: ClientGameState | null = null
  let bobPlay: ClientGameState | null = null
  for (let i = 0; i < 6; i++) {
    const [a, b] = await Promise.all([alice.next(), bob.next()]) as { type: string; state?: ClientGameState }[]
    if (a.type === 'game_state' && a.state?.phase === 'playing') alicePlay = a.state!
    if (b.type === 'game_state' && b.state?.phase === 'playing') bobPlay = b.state!
    if (alicePlay && bobPlay) break
  }
  return { alicePlayState: alicePlay!, bobPlayState: bobPlay! }
}

async function waitForPlayingState(ws: WSClient): Promise<ClientGameState> {
  for (let i = 0; i < 12; i++) {
    const m = await ws.next(500) as { type: string; state?: ClientGameState }
    if (m.type === 'game_state' && m.state?.phase === 'playing') return m.state!
  }
  throw new Error('never reached playing phase')
}

async function completeSetup3(
  alice: WSClient, bob: WSClient, carol: WSClient,
  aliceState: ClientGameState, bobState: ClientGameState, carolState: ClientGameState,
) {
  alice.send({ type: 'set_face_up', cardIds: aliceState.self.hand.slice(0, 3).map(c => c.id) })
  bob.send({ type: 'set_face_up', cardIds: bobState.self.hand.slice(0, 3).map(c => c.id) })
  carol.send({ type: 'set_face_up', cardIds: carolState.self.hand.slice(0, 3).map(c => c.id) })
  // Wait for ALL three clients to fully drain through to their playing game_state so no
  // leftover setup messages remain in any queue when subsequent test steps run.
  const [playState] = await Promise.all([
    waitForPlayingState(alice),
    waitForPlayingState(bob),
    waitForPlayingState(carol),
  ])
  return playState
}

/** Drain up to `n` messages from a client; stops early on timeout. */
async function drain(ws: WSClient, n: number, timeoutMs = 500): Promise<{ type: string; [k: string]: unknown }[]> {
  const results: { type: string; [k: string]: unknown }[] = []
  for (let i = 0; i < n; i++) {
    try { results.push(await ws.next(timeoutMs) as { type: string; [k: string]: unknown }) }
    catch { break }
  }
  return results
}

function findGameState(msgs: { type: string; [k: string]: unknown }[]): ClientGameState | undefined {
  return (msgs.find(m => m.type === 'game_state') as { type: string; state: ClientGameState } | undefined)?.state
}

// ── Playing phase disconnect ─────────────────────────────────────────────────

Deno.test('disconnect during playing (2 players): game ends immediately', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setup2(wsUrl)
    const { aliceState, bobState } = await startGame2(alice, bob)
    await completeSetup2(alice, bob, aliceState, bobState)

    bob.close()

    const msgs = await drain(alice, 2)
    const playerLeft = msgs.find(m => m.type === 'player_left')
    const gs = findGameState(msgs)

    assertExists(playerLeft)
    assertExists(gs)
    assertEquals(gs!.phase, 'finished')
    assertExists(gs!.loser)

    alice.close()
  })
})

Deno.test('disconnect during playing (2 players): disconnected player is loser when holding cards', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob, bobId } = await setup2(wsUrl)
    const { aliceState, bobState } = await startGame2(alice, bob)
    await completeSetup2(alice, bob, aliceState, bobState)

    // Bob disconnects immediately after setup — he still has cards
    bob.close()

    const msgs = await drain(alice, 2)
    const gs = findGameState(msgs)
    assertExists(gs)
    assertEquals(gs!.loser, bobId)

    alice.close()
  })
})

Deno.test('disconnect during playing (3 players): game continues with remaining 2', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob, carol, carolId } = await setup3(wsUrl)
    const { aliceState, bobState, carolState } = await startGame3(alice, bob, carol)
    await completeSetup3(alice, bob, carol, aliceState, bobState, carolState)

    carol.close()

    const aliceMsgs = await drain(alice, 2)
    const bobMsgs = await drain(bob, 2)

    const aliceGs = findGameState(aliceMsgs)
    const bobGs = findGameState(bobMsgs)

    assertExists(aliceGs)
    assertExists(bobGs)
    // 2 active players remain — game must still be running
    assertEquals(aliceGs!.phase, 'playing')
    assertEquals(bobGs!.phase, 'playing')
    // Carol is now visible as finished in both views
    const carolForAlice = aliceGs!.opponents.find(o => o.id === carolId)
    assertExists(carolForAlice)
    assertEquals(carolForAlice!.isFinished, true)

    alice.close()
    bob.close()
  })
})

Deno.test('disconnect during playing: turn advances when disconnected player held the turn', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob, carol, aliceId, bobId, carolId } = await setup3(wsUrl)
    const { aliceState, bobState, carolState } = await startGame3(alice, bob, carol)
    const playingState = await completeSetup3(alice, bob, carol, aliceState, bobState, carolState)
    assertExists(playingState)

    // Identify who goes first and disconnect them
    const firstId = playingState.currentPlayerId!
    const disconnecting =
      firstId === aliceId ? alice :
      firstId === bobId   ? bob   :
      carol
    const [rem1, rem2] = [alice, bob, carol].filter(w => w !== disconnecting)

    disconnecting.close()

    // Drain 3 to account for a possible admin_changed notification before game_state
    const msgs = await drain(rem1, 3)
    const gs = findGameState(msgs)

    assertExists(gs)
    assertEquals(gs!.phase, 'playing')
    // Turn must have been handed to someone other than the disconnected player
    assertEquals(gs!.currentPlayerId !== firstId, true)

    rem1.close()
    rem2.close()
  })
})

// ── Setup phase disconnect ───────────────────────────────────────────────────

Deno.test('disconnect during setup (2 players): game ends immediately', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob } = await setup2(wsUrl)
    await startGame2(alice, bob)
    // Neither player has set face-up cards yet

    bob.close()

    const msgs = await drain(alice, 2)
    const playerLeft = msgs.find(m => m.type === 'player_left')
    const gs = findGameState(msgs)

    assertExists(playerLeft)
    assertExists(gs)
    assertEquals(gs!.phase, 'finished')

    alice.close()
  })
})

Deno.test('disconnect during setup (3 players): game stays in setup while others still choosing', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob, carol } = await setup3(wsUrl)
    const { aliceState } = await startGame3(alice, bob, carol)

    // Only Alice sets face-up cards
    alice.send({ type: 'set_face_up', cardIds: aliceState.self.hand.slice(0, 3).map(c => c.id) })
    await drain(alice, 2, 300)
    await drain(bob, 2, 300)
    await drain(carol, 2, 300)

    // Carol disconnects — Bob has still not set face-up
    carol.close()

    const msgs = await drain(alice, 2)
    const gs = findGameState(msgs)

    assertExists(gs)
    // Bob hasn't confirmed yet so game must stay in setup
    assertEquals(gs!.phase, 'setup')

    alice.close()
    bob.close()
  })
})

Deno.test('disconnect during setup (3 players): game advances to playing when all remaining players are ready', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob, carol } = await setup3(wsUrl)
    const { aliceState, bobState } = await startGame3(alice, bob, carol)

    // Alice and Bob set face-up; Carol has not
    alice.send({ type: 'set_face_up', cardIds: aliceState.self.hand.slice(0, 3).map(c => c.id) })
    bob.send({ type: 'set_face_up', cardIds: bobState.self.hand.slice(0, 3).map(c => c.id) })
    await drain(alice, 4, 300)
    await drain(bob, 4, 300)
    await drain(carol, 4, 300)

    // Carol disconnects without setting her face-up cards
    carol.close()

    const aliceMsgs = await drain(alice, 2)
    const bobMsgs = await drain(bob, 2)

    const aliceGs = findGameState(aliceMsgs)
    const bobGs = findGameState(bobMsgs)

    assertExists(aliceGs)
    assertExists(bobGs)
    // Server auto-assigns Carol's face-up cards and transitions to playing
    assertEquals(aliceGs!.phase, 'playing')
    assertEquals(bobGs!.phase, 'playing')

    alice.close()
    bob.close()
  })
})

Deno.test('disconnect during setup: currentPlayerIndex skips disconnected player when entering playing', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const { alice, bob, carol, carolId } = await setup3(wsUrl)
    const { aliceState, bobState } = await startGame3(alice, bob, carol)

    alice.send({ type: 'set_face_up', cardIds: aliceState.self.hand.slice(0, 3).map(c => c.id) })
    bob.send({ type: 'set_face_up', cardIds: bobState.self.hand.slice(0, 3).map(c => c.id) })
    await drain(alice, 4, 300)
    await drain(bob, 4, 300)
    await drain(carol, 4, 300)

    carol.close()

    const msgs = await drain(alice, 2)
    const gs = findGameState(msgs)

    assertExists(gs)
    assertEquals(gs!.phase, 'playing')
    // The first active player must not be Carol
    assertEquals(gs!.currentPlayerId !== carolId, true)

    alice.close()
    bob.close()
  })
})
