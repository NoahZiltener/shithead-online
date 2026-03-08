import { assertEquals } from '@std/assert'
import { WSClient, withServer } from './helpers.ts'

Deno.test('WS: create_room returns room_created', async () => {
  await withServer(async (base) => {
    const ws = new WSClient(base.replace('http', 'ws') + '/ws')
    await ws.waitForOpen()
    ws.send({ type: 'create_room', playerName: 'Alice' })
    const msg = await ws.next() as { type: string; playerId: string; roomId: string }
    assertEquals(msg.type, 'room_created')
    assertEquals(typeof msg.playerId, 'string')
    assertEquals(typeof msg.roomId, 'string')
    assertEquals(msg.roomId.length, 6)
    ws.close()
  })
})

Deno.test('WS: join returns joined with players and adminId', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const alice = new WSClient(wsUrl)
    const bob = new WSClient(wsUrl)
    await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

    alice.send({ type: 'create_room', playerName: 'Alice' })
    const created = await alice.next() as { type: string; playerId: string; roomId: string }
    assertEquals(created.type, 'room_created')

    bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
    const joined = await bob.next() as { type: string; playerId: string; adminId: string; players: { id: string; name: string }[] }
    assertEquals(joined.type, 'joined')
    assertEquals(typeof joined.playerId, 'string')
    assertEquals(joined.adminId, created.playerId)
    assertEquals(joined.players.length, 2)

    alice.close()
    bob.close()
  })
})

Deno.test('WS: join unknown room returns error', async () => {
  await withServer(async (base) => {
    const ws = new WSClient(base.replace('http', 'ws') + '/ws')
    await ws.waitForOpen()
    ws.send({ type: 'join', roomId: 'DOESNT', playerName: 'Alice' })
    const msg = await ws.next() as { type: string }
    assertEquals(msg.type, 'error')
    ws.close()
  })
})

Deno.test('WS: second player gets player_joined notification', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const alice = new WSClient(wsUrl)
    const bob = new WSClient(wsUrl)
    await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

    alice.send({ type: 'create_room', playerName: 'Alice' })
    const created = await alice.next() as { type: string; roomId: string }

    bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
    await bob.next() // joined

    const notification = await alice.next() as { type: string; playerName: string }
    assertEquals(notification.type, 'player_joined')
    assertEquals(notification.playerName, 'Bob')

    alice.close()
    bob.close()
  })
})

Deno.test('WS: start_game broadcasts to all players in room', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const alice = new WSClient(wsUrl)
    const bob = new WSClient(wsUrl)
    await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

    alice.send({ type: 'create_room', playerName: 'Alice' })
    const created = await alice.next() as { type: string; roomId: string }

    bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
    await bob.next() // joined
    await alice.next() // player_joined for Bob

    alice.send({ type: 'start_game' })
    const [aliceMsg, bobMsg] = await Promise.all([alice.next(), bob.next()]) as { type: string }[]
    assertEquals(aliceMsg.type, 'game_started')
    assertEquals(bobMsg.type, 'game_started')

    alice.close()
    bob.close()
  })
})

Deno.test('WS: only admin can start game', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const alice = new WSClient(wsUrl)
    const bob = new WSClient(wsUrl)
    await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

    alice.send({ type: 'create_room', playerName: 'Alice' })
    const created = await alice.next() as { type: string; roomId: string }

    bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
    await bob.next() // joined
    await alice.next() // player_joined for Bob

    bob.send({ type: 'start_game' })
    const msg = await bob.next() as { type: string }
    assertEquals(msg.type, 'error')

    alice.close()
    bob.close()
  })
})

Deno.test('WS: message before join returns error', async () => {
  await withServer(async (base) => {
    const ws = new WSClient(base.replace('http', 'ws') + '/ws')
    await ws.waitForOpen()
    ws.send({ type: 'start_game' })
    const msg = await ws.next() as { type: string }
    assertEquals(msg.type, 'error')
    ws.close()
  })
})

Deno.test('WS: disconnect notifies other players', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const alice = new WSClient(wsUrl)
    const bob = new WSClient(wsUrl)
    await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

    alice.send({ type: 'create_room', playerName: 'Alice' })
    const created = await alice.next() as { type: string; roomId: string }

    bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
    await bob.next() // joined
    await alice.next() // player_joined for Bob

    bob.close()
    const notification = await alice.next() as { type: string }
    assertEquals(notification.type, 'player_left')

    alice.close()
  })
})

Deno.test('WS: admin transfer on host disconnect', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'
    const alice = new WSClient(wsUrl)
    const bob = new WSClient(wsUrl)
    await Promise.all([alice.waitForOpen(), bob.waitForOpen()])

    alice.send({ type: 'create_room', playerName: 'Alice' })
    const created = await alice.next() as { type: string; roomId: string; playerId: string }

    bob.send({ type: 'join', roomId: created.roomId, playerName: 'Bob' })
    const joined = await bob.next() as { type: string; playerId: string }
    await alice.next() // player_joined for Bob

    alice.close()
    const playerLeft = await bob.next() as { type: string }
    assertEquals(playerLeft.type, 'player_left')
    const adminChanged = await bob.next() as { type: string; adminId: string }
    assertEquals(adminChanged.type, 'admin_changed')
    assertEquals(adminChanged.adminId, joined.playerId)

    bob.close()
  })
})
