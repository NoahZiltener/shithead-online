import { assertEquals, assertNotEquals } from '@std/assert'
import { createRoom, createRoomStore, getRoom, removePlayer, type Sender } from '../src/rooms.ts'

const mockSender: Sender = { send: () => {} }

Deno.test('createRoom creates a new room with a generated code', () => {
  const store = createRoomStore()
  const room = createRoom(store)
  assertEquals(store.size, 1)
  assertEquals(room.players.size, 0)
  assertEquals(room.id.length, 6)
})

Deno.test('createRoom generates unique codes', () => {
  const store = createRoomStore()
  const r1 = createRoom(store)
  const r2 = createRoom(store)
  assertNotEquals(r1.id, r2.id)
  assertEquals(store.size, 2)
})

Deno.test('getRoom returns existing room', () => {
  const store = createRoomStore()
  const room = createRoom(store)
  const found = getRoom(store, room.id)
  assertEquals(found, room)
})

Deno.test('getRoom returns undefined for unknown id', () => {
  const store = createRoomStore()
  const found = getRoom(store, 'DOESNT_EXIST')
  assertEquals(found, undefined)
})

Deno.test('removePlayer removes a player from the room', () => {
  const store = createRoomStore()
  const room = createRoom(store)
  room.players.set('p1', { id: 'p1', name: 'Alice', ws: mockSender })
  room.players.set('p2', { id: 'p2', name: 'Bob', ws: mockSender })

  removePlayer(store, room, 'p1')

  assertEquals(room.players.size, 1)
  assertEquals(store.size, 1)
})

Deno.test('removePlayer deletes room from store when empty', () => {
  const store = createRoomStore()
  const room = createRoom(store)
  room.players.set('p1', { id: 'p1', name: 'Alice', ws: mockSender })

  removePlayer(store, room, 'p1')

  assertEquals(room.players.size, 0)
  assertEquals(store.size, 0)
})
