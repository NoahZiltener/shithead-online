import { assertEquals, assertExists } from '@std/assert'
import { WSClient, withServer } from '../helpers.ts'

Deno.test('Chat: Player can send a message', async () => {
  await withServer(async (base) => {
    const ws = new WSClient(base.replace('http', 'ws') + '/ws')
    await ws.waitForOpen()

    ws.send({ type: 'create_room', playerName: 'Alice' })
    const createMsg = await ws.next() as { type: string; roomId: string }
    assertEquals(createMsg.type, 'room_created')

    ws.send({ type: 'send_message', text: 'Hello!' })
    const chatMsg = await ws.next() as { type: string }
    assertEquals(chatMsg.type, 'chat_message')

    ws.close()
  })
})

Deno.test('Chat: Message is broadcasted to all players in room', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'

    // Player 1: Create room
    const alice = new WSClient(wsUrl)
    await alice.waitForOpen()
    alice.send({ type: 'create_room', playerName: 'Alice' })
    const createMsg = await alice.next() as { type: string; roomId: string; playerId: string }
    assertEquals(createMsg.type, 'room_created')
    const roomId = createMsg.roomId

    // Player 2: Join room
    const bob = new WSClient(wsUrl)
    await bob.waitForOpen()
    bob.send({ type: 'join', roomId, playerName: 'Bob' })
    const joinedMsg = await bob.next() as { type: string }
    assertEquals(joinedMsg.type, 'joined')

    // Alice receives join notification
    const playerJoinedMsg = await alice.next() as { type: string }
    assertEquals(playerJoinedMsg.type, 'player_joined')

    // Alice sends a message
    alice.send({ type: 'send_message', text: 'Hello Bob!' })

    // Both receive the message
    const chatMsg1 = await alice.next() as { type: string; message: { text: string; senderName: string } }
    assertEquals(chatMsg1.type, 'chat_message')
    assertEquals(chatMsg1.message.text, 'Hello Bob!')
    assertEquals(chatMsg1.message.senderName, 'Alice')

    const chatMsg2 = await bob.next() as { type: string; message: { text: string; senderName: string } }
    assertEquals(chatMsg2.type, 'chat_message')
    assertEquals(chatMsg2.message.text, 'Hello Bob!')
    assertEquals(chatMsg2.message.senderName, 'Alice')

    alice.close()
    bob.close()
  })
})

Deno.test('Chat: Chat history is sent when joining', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'

    // Player 1: Create room and send messages
    const alice = new WSClient(wsUrl)
    await alice.waitForOpen()
    alice.send({ type: 'create_room', playerName: 'Alice' })
    const createMsg = await alice.next() as { type: string; roomId: string }
    const roomId = createMsg.roomId

    // Send 3 messages
    alice.send({ type: 'send_message', text: 'Message 1' })
    await alice.next() // consume broadcast
    alice.send({ type: 'send_message', text: 'Message 2' })
    await alice.next() // consume broadcast
    alice.send({ type: 'send_message', text: 'Message 3' })
    await alice.next() // consume broadcast

    // Player 2: Join and should receive history
    const bob = new WSClient(wsUrl)
    await bob.waitForOpen()
    bob.send({ type: 'join', roomId, playerName: 'Bob' })
    const joinedMsg = await bob.next() as { type: string; chatHistory: Array<{ text: string }> }
    assertEquals(joinedMsg.type, 'joined')
    assertEquals(joinedMsg.chatHistory.length, 3)
    assertEquals(joinedMsg.chatHistory[0].text, 'Message 1')
    assertEquals(joinedMsg.chatHistory[1].text, 'Message 2')
    assertEquals(joinedMsg.chatHistory[2].text, 'Message 3')

    alice.close()
    bob.close()
  })
})

Deno.test('Chat: Invalid message is rejected', async () => {
  await withServer(async (base) => {
    const ws = new WSClient(base.replace('http', 'ws') + '/ws')
    await ws.waitForOpen()

    ws.send({ type: 'create_room', playerName: 'Alice' })
    await ws.next() // consume room_created

    // Send empty message
    ws.send({ type: 'send_message', text: '' })
    const errorMsg = await ws.next() as { type: string; message: string }
    assertEquals(errorMsg.type, 'error')
    assertEquals(errorMsg.message, 'Message cannot be empty')

    ws.close()
  })
})

Deno.test('Chat: Message exceeding limit is rejected', async () => {
  await withServer(async (base) => {
    const ws = new WSClient(base.replace('http', 'ws') + '/ws')
    await ws.waitForOpen()

    ws.send({ type: 'create_room', playerName: 'Alice' })
    await ws.next() // consume room_created

    // Send very long message
    const longText = 'a'.repeat(501)
    ws.send({ type: 'send_message', text: longText })
    const errorMsg = await ws.next() as { type: string }
    assertEquals(errorMsg.type, 'error')

    ws.close()
  })
})

Deno.test('Chat: Messages maintain order', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'

    // Player 1: Create room
    const alice = new WSClient(wsUrl)
    await alice.waitForOpen()
    alice.send({ type: 'create_room', playerName: 'Alice' })
    const createMsg = await alice.next() as { type: string; roomId: string }
    const roomId = createMsg.roomId

    // Player 2: Join
    const bob = new WSClient(wsUrl)
    await bob.waitForOpen()
    bob.send({ type: 'join', roomId, playerName: 'Bob' })
    await bob.next() // consume joined
    await alice.next() // consume player_joined

    // Exchange messages
    alice.send({ type: 'send_message', text: 'First' })
    const msg1 = await alice.next() as { type: string; message: { text: string } }
    assertEquals(msg1.message.text, 'First')
    const msg1b = await bob.next() as { type: string; message: { text: string } }
    assertEquals(msg1b.message.text, 'First')

    bob.send({ type: 'send_message', text: 'Second' })
    const msg2b = await bob.next() as { type: string; message: { text: string } }
    assertEquals(msg2b.message.text, 'Second')
    const msg2 = await alice.next() as { type: string; message: { text: string } }
    assertEquals(msg2.message.text, 'Second')

    // New player joins and gets history in order
    const charlie = new WSClient(wsUrl)
    await charlie.waitForOpen()
    charlie.send({ type: 'join', roomId, playerName: 'Charlie' })
    const joinedMsg = await charlie.next() as { type: string; chatHistory: Array<{ text: string; senderName: string }> }
    assertEquals(joinedMsg.chatHistory.length, 2)
    assertEquals(joinedMsg.chatHistory[0].text, 'First')
    assertEquals(joinedMsg.chatHistory[0].senderName, 'Alice')
    assertEquals(joinedMsg.chatHistory[1].text, 'Second')
    assertEquals(joinedMsg.chatHistory[1].senderName, 'Bob')

    alice.close()
    bob.close()
    charlie.close()
  })
})

Deno.test('Chat: Empty room has no chat history', async () => {
  await withServer(async (base) => {
    const wsUrl = base.replace('http', 'ws') + '/ws'

    const alice = new WSClient(wsUrl)
    await alice.waitForOpen()
    alice.send({ type: 'create_room', playerName: 'Alice' })
    const createMsg = await alice.next() as { type: string; roomId: string }
    const roomId = createMsg.roomId

    const bob = new WSClient(wsUrl)
    await bob.waitForOpen()
    bob.send({ type: 'join', roomId, playerName: 'Bob' })
    const joinedMsg = await bob.next() as { type: string; chatHistory: unknown[] }
    assertEquals(joinedMsg.chatHistory.length, 0)

    alice.close()
    bob.close()
  })
})
