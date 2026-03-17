import { getLogger } from '@logtape/logtape'
import type { GameMode } from '../../shared/src/types.ts'
import type { ServerGameState } from './game/index.ts'

const logger = getLogger(['shithead-online', 'rooms'])

export type { GameMode }

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
  gameMode: GameMode
  gameState: ServerGameState | null
}

export const MAX_PLAYERS: Record<GameMode, number> = {
  normal: 5,
  double_deck: 10,
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
  const room: Room = { id, players: new Map(), adminId: '', gameMode: 'normal', gameState: null }
  store.set(id, room)
  logger.debug('Room {roomId} created', { roomId: id })
  return room
}

export function getRoom(store: RoomStore, roomId: string): Room | undefined {
  return store.get(roomId)
}

export function removePlayer(store: RoomStore, room: Room, playerId: string): void {
  room.players.delete(playerId)
  if (room.players.size === 0) {
    store.delete(room.id)
    logger.debug('Room {roomId} removed (empty)', { roomId: room.id })
  }
}
