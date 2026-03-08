export interface Sender {
  send(data: string): void
}

export type PlayerConn = {
  id: string
  name: string
  ws: Sender
}

export type Room = {
  id: string
  players: Map<string, PlayerConn>
  adminId: string
}

export type RoomStore = Map<string, Room>

export function createRoomStore(): RoomStore {
  return new Map()
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function createRoom(store: RoomStore): Room {
  let id: string
  do { id = generateRoomCode() } while (store.has(id))
  const room: Room = { id, players: new Map(), adminId: '' }
  store.set(id, room)
  return room
}

export function getRoom(store: RoomStore, roomId: string): Room | undefined {
  return store.get(roomId)
}

export function removePlayer(store: RoomStore, room: Room, playerId: string): void {
  room.players.delete(playerId)
  if (room.players.size === 0) {
    store.delete(room.id)
  }
}
