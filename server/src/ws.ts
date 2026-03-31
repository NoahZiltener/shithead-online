import { upgradeWebSocket } from 'hono/deno'
import type { WSContext } from 'hono/ws'
import { getLogger } from '@logtape/logtape'
import type { ClientMessage, GameMode, ServerMessage } from '../../shared/src/types.ts'
import { dealCards, getClientState, pickUpPile, playCards, setFaceUp } from './game/index.ts'
import { createRoom, getRoom, MAX_PLAYERS, removePlayer, type Room, type RoomStore } from './rooms.ts'
import { sendGameSummary } from './discord.ts'

const logger = getLogger(['shithead-online', 'ws'])

function send(ws: WSContext, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg))
}

function broadcast(room: Room, msg: ServerMessage, excludeId?: string): void {
  const json = JSON.stringify(msg)
  for (const [id, player] of room.players) {
    if (id !== excludeId) player.ws.send(json)
  }
}

function broadcastGameState(room: Room): void {
  if (!room.gameState) return
  for (const [id, player] of room.players) {
    const state = getClientState(room.gameState, id)
    player.ws.send(JSON.stringify({ type: 'game_state', state } satisfies ServerMessage))
  }
}

const VALID_MODES = new Set<GameMode>(['normal', 'double_deck'])

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
          logger.warn('Received invalid JSON from player {playerId}', { playerId })
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
          logger.info('Player {playerName} created room {roomId}', { playerName: msg.playerName, playerId, roomId: room.id })
          send(ws, { type: 'room_created', playerId, roomId: room.id, gameMode: room.gameMode })
          return
        }

        if (msg.type === 'join') {
          const target = getRoom(store, msg.roomId)
          if (!target) {
            logger.warn('Join failed: room {roomId} not found', { roomId: msg.roomId })
            send(ws, { type: 'error', message: `Room "${msg.roomId}" not found.` })
            return
          }
          if (target.players.size >= MAX_PLAYERS[target.gameMode]) {
            logger.warn('Join failed: room {roomId} is full', { roomId: msg.roomId })
            send(ws, { type: 'error', message: 'Room is full.' })
            return
          }
          if (room && playerId) {
            broadcast(room, { type: 'player_left', playerId })
            removePlayer(store, room, playerId)
          }
          playerId = crypto.randomUUID()
          room = target
          room.players.set(playerId, { id: playerId, name: msg.playerName, ws })
          logger.info('Player {playerName} joined room {roomId}', { playerName: msg.playerName, playerId, roomId: room.id })
          const players = [...room.players.values()].map((p) => ({ id: p.id, name: p.name }))
          send(ws, { type: 'joined', playerId, roomId: room.id, adminId: room.adminId, players, gameMode: room.gameMode })
          broadcast(room, { type: 'player_joined', playerId, playerName: msg.playerName }, playerId)
          return
        }

        if (!room || !playerId) {
          send(ws, { type: 'error', message: 'Not in a room. Send a "join" or "create_room" message first.' })
          return
        }

        if (msg.type === 'set_game_mode') {
          if (playerId !== room.adminId) {
            send(ws, { type: 'error', message: 'Only the host can change the game mode.' })
            return
          }
          if (!VALID_MODES.has(msg.mode)) {
            send(ws, { type: 'error', message: 'Invalid game mode.' })
            return
          }
          if (room.players.size > MAX_PLAYERS[msg.mode]) {
            send(ws, { type: 'error', message: `Cannot switch to this mode: too many players (max ${MAX_PLAYERS[msg.mode]}).` })
            return
          }
          room.gameMode = msg.mode
          broadcast(room, { type: 'game_mode_changed', mode: msg.mode })
          return
        }

        if (msg.type === 'kick_player') {
          if (playerId !== room.adminId) {
            send(ws, { type: 'error', message: 'Only the host can kick players.' })
            return
          }
          if (msg.playerId === playerId) {
            send(ws, { type: 'error', message: 'You cannot kick yourself.' })
            return
          }
          const target = room.players.get(msg.playerId)
          if (!target) {
            send(ws, { type: 'error', message: 'Player not found.' })
            return
          }
          target.ws.send(JSON.stringify({ type: 'kicked' }))
          logger.info('Player {targetId} was kicked from room {roomId}', { targetId: msg.playerId, roomId: room.id, byPlayerId: playerId })
          removePlayer(store, room, msg.playerId)
          broadcast(room, { type: 'player_left', playerId: msg.playerId })
          return
        }

        if (msg.type === 'start_game') {
          if (playerId !== room.adminId) {
            send(ws, { type: 'error', message: 'Only the host can start the game.' })
            return
          }
          if (room.players.size < 2) {
            send(ws, { type: 'error', message: 'Need at least 2 players to start.' })
            return
          }
          if (room.gameState !== null) {
            send(ws, { type: 'error', message: 'Game already started.' })
            return
          }

          const players = [...room.players.values()].map((p) => ({ id: p.id, name: p.name }))
          room.gameState = dealCards(players, room.gameMode === 'double_deck')
          room.gameStartedAt = Date.now()
          logger.info('Game started in room {roomId} with {playerCount} players', { roomId: room.id, playerCount: players.length })

          // Send each player their personalised initial state
          for (const [pid, conn] of room.players) {
            const state = getClientState(room.gameState, pid)
            conn.ws.send(JSON.stringify({ type: 'game_started', state } satisfies ServerMessage))
          }
          return
        }

        // ── Game actions ────────────────────────────────────────────────────

        if (!room.gameState) {
          send(ws, { type: 'error', message: 'Game has not started yet.' })
          return
        }

        if (msg.type === 'set_face_up') {
          if (room.gameState.phase !== 'setup') {
            send(ws, { type: 'error', message: 'Not in setup phase.' })
            return
          }
          const player = room.gameState.players.find((p) => p.id === playerId)
          if (!player) { send(ws, { type: 'error', message: 'Player not in game.' }); return }
          if (player.hasSetFaceUp) { send(ws, { type: 'error', message: 'Already selected face-up cards.' }); return }

          try {
            room.gameState = setFaceUp(room.gameState, playerId, msg.cardIds)
          } catch (e) {
            send(ws, { type: 'error', message: (e as Error).message })
            return
          }

          const allReady = room.gameState.phase === 'playing'
          broadcast(room, { type: 'face_up_set', playerId, allReady })

          // Send updated game state to all (so everyone sees the face-up cards)
          broadcastGameState(room)
          return
        }

        if (msg.type === 'play_card') {
          if (room.gameState.phase !== 'playing') {
            send(ws, { type: 'error', message: 'Game is not in playing phase.' })
            return
          }

          let result
          try {
            result = playCards(room.gameState, playerId, msg.cardIds)
          } catch (e) {
            send(ws, { type: 'error', message: (e as Error).message })
            return
          }

          room.gameState = result.state
          broadcastGameState(room)
          if (result.gameOver) {
            sendGameSummary(room.id, room.gameMode, result.state, room.gameStartedAt ?? Date.now())
          }
          return
        }

        if (msg.type === 'pick_up_pile') {
          if (room.gameState.phase !== 'playing') {
            send(ws, { type: 'error', message: 'Game is not in playing phase.' })
            return
          }

          try {
            room.gameState = pickUpPile(room.gameState, playerId)
          } catch (e) {
            send(ws, { type: 'error', message: (e as Error).message })
            return
          }

          broadcastGameState(room)
          return
        }

        if (msg.type === 'peek_face_down') {
          if (room.gameState.phase !== 'playing') {
            send(ws, { type: 'error', message: 'Not in playing phase.' })
            return
          }
          const gameState = room.gameState
          const player = gameState.players[gameState.currentPlayerIndex]
          if (player.id !== playerId) {
            send(ws, { type: 'error', message: 'Not your turn.' })
            return
          }
          const drawPileEmpty = gameState.drawPile.length === 0
          const isInFaceDownPhase = player.hand.length === 0 && !(drawPileEmpty && player.faceUp.length > 0)
          if (!isInFaceDownPhase) {
            send(ws, { type: 'error', message: 'Not in face-down phase.' })
            return
          }
          const fdMatch = msg.fdId.match(/^fd_(\d+)$/)
          if (!fdMatch) {
            send(ws, { type: 'error', message: 'Invalid face-down card ID.' })
            return
          }
          const fdIdx = parseInt(fdMatch[1], 10)
          if (fdIdx < 0 || fdIdx >= player.faceDown.length) {
            send(ws, { type: 'error', message: 'Invalid face-down card index.' })
            return
          }
          send(ws, { type: 'face_down_revealed', fdId: msg.fdId, card: player.faceDown[fdIdx] })
          return
        }

        if (msg.type === 'return_to_lobby') {
          if (!room.gameState || room.gameState.phase !== 'finished') {
            send(ws, { type: 'error', message: 'Can only return to lobby after the game has finished.' })
            return
          }
          room.gameState = null
          broadcast(room, { type: 'lobby_reset' })
          return
        }
      },

      onClose() {
        if (!room || !playerId || !room.players.has(playerId)) {
          room = null
          playerId = null
          return
        }
        if (room && playerId) {
          const wasAdmin = playerId === room.adminId
          const disconnectedId = playerId
          logger.info('Player {playerId} disconnected from room {roomId}', { playerId, roomId: room.id })
          broadcast(room, { type: 'player_left', playerId })
          removePlayer(store, room, disconnectedId)

          if (wasAdmin && room.players.size > 0) {
            const newAdmin = room.players.values().next().value!
            room.adminId = newAdmin.id
            logger.info('Admin role transferred to {newAdminId} in room {roomId}', { newAdminId: newAdmin.id, roomId: room.id })
            broadcast(room, { type: 'admin_changed', adminId: newAdmin.id })
          }

          // Handle mid-game disconnect
          if (room.gameState && room.gameState.phase === 'playing') {
            const gamePlayerIdx = room.gameState.players.findIndex((p) => p.id === disconnectedId)
            if (gamePlayerIdx !== -1) {
              const disconnectedPlayer = room.gameState.players[gamePlayerIdx]
              const newFinished = [...room.gameState.finishedPlayerIds]
              if (!newFinished.includes(disconnectedId)) newFinished.push(disconnectedId)
              const newPlayers = room.gameState.players.map((p) =>
                p.id === disconnectedId ? { ...p, isFinished: true } : p
              )
              const activePlayers = newPlayers.filter((p) => !p.isFinished)

              if (activePlayers.length <= 1) {
                const hadCards =
                  disconnectedPlayer.hand.length > 0 ||
                  disconnectedPlayer.faceUp.length > 0 ||
                  disconnectedPlayer.faceDown.length > 0
                room.gameState = {
                  ...room.gameState,
                  players: newPlayers,
                  finishedPlayerIds: newFinished,
                  phase: 'finished',
                  loser: hadCards ? disconnectedId : activePlayers[0]?.id,
                }
                logger.info('Game ended in room {roomId} due to player {playerId} disconnecting', { roomId: room.id, playerId: disconnectedId })
                sendGameSummary(room.id, room.gameMode, room.gameState, room.gameStartedAt ?? Date.now())
              } else {
                // Continue with remaining players; advance turn if it was disconnected player's turn
                let currentIdx = room.gameState.currentPlayerIndex
                if (currentIdx === gamePlayerIdx) {
                  const n = newPlayers.length
                  let next = (currentIdx + 1) % n
                  while (newPlayers[next].isFinished) next = (next + 1) % n
                  currentIdx = next
                }
                room.gameState = { ...room.gameState, players: newPlayers, finishedPlayerIds: newFinished, currentPlayerIndex: currentIdx }
              }

              if (room.players.size > 0) broadcastGameState(room)
            }
          }

          room = null
          playerId = null
        }
      },
    }
  })
}
