import { upgradeWebSocket } from 'hono/deno'
import type { WSContext } from 'hono/ws'
import type { ClientMessage, ServerMessage } from '../../shared/src/types.ts'
import { createRoom, getRoom, removePlayer, type Room, type RoomStore } from './rooms.ts'

function send(ws: WSContext, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg))
}

function broadcast(room: Room, msg: ServerMessage, excludeId?: string): void {
  const json = JSON.stringify(msg)
  for (const [id, player] of room.players) {
    if (id !== excludeId) player.ws.send(json)
  }
}

export function createWsHandler(store: RoomStore) {
  return upgradeWebSocket(() => {
    let room: Room | null = null
    let playerId: string | null = null

    return {
      onMessage(evt, ws) {
        let msg: ClientMessage
        try {
          msg = JSON.parse(evt.data as string)
        } catch {
          send(ws, { type: 'error', message: 'Invalid JSON' })
          return
        }

        if (msg.type === 'create_room') {
          if (room && playerId) {
            broadcast(room, { type: 'player_left', playerId })
            removePlayer(store, room, playerId)
          }
          playerId = crypto.randomUUID()
          room = createRoom(store)
          room.adminId = playerId
          room.players.set(playerId, { id: playerId, name: msg.playerName, ws })
          send(ws, { type: 'room_created', playerId, roomId: room.id })
          return
        }

        if (msg.type === 'join') {
          const target = getRoom(store, msg.roomId)
          if (!target) {
            send(ws, { type: 'error', message: `Room "${msg.roomId}" not found.` })
            return
          }
          if (room && playerId) {
            broadcast(room, { type: 'player_left', playerId })
            removePlayer(store, room, playerId)
          }
          playerId = crypto.randomUUID()
          room = target
          room.players.set(playerId, { id: playerId, name: msg.playerName, ws })
          const players = [...room.players.values()].map((p) => ({ id: p.id, name: p.name }))
          send(ws, { type: 'joined', playerId, roomId: room.id, adminId: room.adminId, players })
          broadcast(room, { type: 'player_joined', playerId, playerName: msg.playerName }, playerId)
          return
        }

        if (!room || !playerId) {
          send(ws, { type: 'error', message: 'Not in a room. Send a "join" or "create_room" message first.' })
          return
        }

        if (msg.type === 'start_game') {
          if (playerId !== room.adminId) {
            send(ws, { type: 'error', message: 'Only the host can start the game.' })
            return
          }
          broadcast(room, { type: 'game_started' })
        }

        // play_card and pick_up_pile: game logic to be added
      },

      onClose() {
        if (room && playerId) {
          const wasAdmin = playerId === room.adminId
          broadcast(room, { type: 'player_left', playerId })
          removePlayer(store, room, playerId)

          if (wasAdmin && room.players.size > 0) {
            const newAdmin = room.players.values().next().value!
            room.adminId = newAdmin.id
            broadcast(room, { type: 'admin_changed', adminId: newAdmin.id })
          }

          room = null
          playerId = null
        }
      },
    }
  })
}
