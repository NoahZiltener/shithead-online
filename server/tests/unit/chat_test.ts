import { assertEquals, assertStringIncludes } from '@std/assert'
import { validateMessage, addChatMessage, getChatHistory } from '../../src/chat.ts'
import { createRoom } from '../../src/rooms.ts'
import { createRoomStore } from '../../src/rooms.ts'

Deno.test('validateMessage: accepts valid messages', () => {
  const result = validateMessage('Hello, world!')
  assertEquals(result.valid, true)
  assertEquals(result.error, undefined)
})

Deno.test('validateMessage: rejects empty messages', () => {
  const result = validateMessage('')
  assertEquals(result.valid, false)
  assertStringIncludes(result.error!, 'empty')
})

Deno.test('validateMessage: rejects whitespace-only messages', () => {
  const result = validateMessage('   ')
  assertEquals(result.valid, false)
  assertStringIncludes(result.error!, 'empty')
})

Deno.test('validateMessage: rejects messages exceeding limit', () => {
  const longText = 'a'.repeat(501)
  const result = validateMessage(longText)
  assertEquals(result.valid, false)
  assertStringIncludes(result.error!, '500')
})

Deno.test('validateMessage: accepts message at limit', () => {
  const atLimit = 'a'.repeat(500)
  const result = validateMessage(atLimit)
  assertEquals(result.valid, true)
})

Deno.test('validateMessage: trims whitespace from edges', () => {
  const result = validateMessage('  hello  ')
  assertEquals(result.valid, true)
})

Deno.test('addChatMessage: adds message successfully', () => {
  const store = createRoomStore()
  const room = createRoom(store)

  const result = addChatMessage(room, 'player1', 'Alice', 'Hello!')
  assertEquals(result.success, true)
  assertEquals(result.message?.senderId, 'player1')
  assertEquals(result.message?.senderName, 'Alice')
  assertEquals(result.message?.text, 'Hello!')
  assertEquals(typeof result.message?.timestamp, 'number')
})

Deno.test('addChatMessage: returns error for invalid message', () => {
  const store = createRoomStore()
  const room = createRoom(store)

  const result = addChatMessage(room, 'player1', 'Alice', '')
  assertEquals(result.success, false)
  assertEquals(result.error, 'Message cannot be empty')
})

Deno.test('addChatMessage: stores message in room history', () => {
  const store = createRoomStore()
  const room = createRoom(store)

  addChatMessage(room, 'player1', 'Alice', 'First')
  addChatMessage(room, 'player2', 'Bob', 'Second')

  assertEquals(room.chatHistory.length, 2)
  assertEquals(room.chatHistory[0].text, 'First')
  assertEquals(room.chatHistory[1].text, 'Second')
})

Deno.test('addChatMessage: enforces max 50 messages', () => {
  const store = createRoomStore()
  const room = createRoom(store)

  for (let i = 0; i < 60; i++) {
    addChatMessage(room, 'player1', 'Alice', `Message ${i}`)
  }

  assertEquals(room.chatHistory.length, 50)
  // Should have the last 50 messages (10-59)
  assertEquals(room.chatHistory[0].text, 'Message 10')
  assertEquals(room.chatHistory[49].text, 'Message 59')
})

Deno.test('getChatHistory: returns copy of messages', () => {
  const store = createRoomStore()
  const room = createRoom(store)

  addChatMessage(room, 'player1', 'Alice', 'Hello')
  const history = getChatHistory(room)

  assertEquals(history.length, 1)
  assertEquals(history[0].text, 'Hello')
})

Deno.test('getChatHistory: returns independent copy (mutations do not affect room)', () => {
  const store = createRoomStore()
  const room = createRoom(store)

  addChatMessage(room, 'player1', 'Alice', 'Hello')
  const history = getChatHistory(room)

  // Modify the copy
  history[0].text = 'Modified'

  // Original should be unchanged
  assertEquals(room.chatHistory[0].text, 'Hello')
})

Deno.test('addChatMessage: trims text', () => {
  const store = createRoomStore()
  const room = createRoom(store)

  const result = addChatMessage(room, 'player1', 'Alice', '  spaced out  ')
  assertEquals(result.message?.text, 'spaced out')
})
