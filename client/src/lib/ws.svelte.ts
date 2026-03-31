import type { Card, ClientGameState, ClientMessage, GameMode, ServerMessage } from '$shared/types.ts'

type Player = { id: string; name: string }

const SESSION_KEY = 'shithead_session'

class GameConnection {
  status = $state<'disconnected' | 'connecting' | 'connected'>('disconnected')
  playerId = $state<string | null>(null)
  roomId = $state<string | null>(null)
  adminId = $state<string | null>(null)
  isAdmin = $derived(this.playerId !== null && this.playerId === this.adminId)
  gameMode = $state<GameMode>('normal')
  maxPlayers = $derived(this.gameMode === 'double_deck' ? 10 : 5)
  players = $state<Player[]>([])
  gameStarted = $state(false)
  gameState = $state<ClientGameState | null>(null)
  error = $state<string | null>(null)
  peekedFdId = $state<string | null>(null)
  peekedCard = $state<Card | null>(null)

  #ws: WebSocket | null = null
  #myName = ''

  #openWebSocket(): WebSocket {
    if (this.#ws) this.#ws.close()
    this.status = 'connecting'
    this.error = null
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${location.host}/ws`)
    this.#ws = ws
    ws.onclose = () => { this.status = 'disconnected' }
    ws.onerror = () => {
      this.error = 'Connection failed. Is the server running?'
      this.status = 'disconnected'
    }
    ws.onmessage = (e) => {
      this.#handleMessage(JSON.parse(e.data as string) as ServerMessage)
    }
    return ws
  }

  createRoom(playerName: string): void {
    this.#myName = playerName
    const ws = this.#openWebSocket()
    ws.onopen = () => {
      this.status = 'connected'
      this.#send({ type: 'create_room', playerName })
    }
  }

  connect(playerName: string, roomId: string): void {
    this.#myName = playerName
    const ws = this.#openWebSocket()
    ws.onopen = () => {
      this.status = 'connected'
      this.#send({ type: 'join', roomId, playerName })
    }
  }

  #handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'room_created':
        this.playerId = msg.playerId
        this.roomId = msg.roomId
        this.adminId = msg.playerId
        this.gameMode = msg.gameMode
        this.players = [{ id: msg.playerId, name: this.#myName }]
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ playerName: this.#myName, roomId: msg.roomId }))
        break
      case 'joined':
        this.playerId = msg.playerId
        this.roomId = msg.roomId
        this.adminId = msg.adminId
        this.gameMode = msg.gameMode
        this.players = msg.players
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ playerName: this.#myName, roomId: msg.roomId }))
        break
      case 'player_joined':
        this.players = [...this.players, { id: msg.playerId, name: msg.playerName }]
        break
      case 'player_left':
        this.players = this.players.filter((p) => p.id !== msg.playerId)
        break
      case 'admin_changed':
        this.adminId = msg.adminId
        break
      case 'game_mode_changed':
        this.gameMode = msg.mode
        break
      case 'kicked':
        sessionStorage.removeItem(SESSION_KEY)
        this.error = 'You were kicked from the room.'
        this.#ws?.close()
        this.#ws = null
        this.playerId = null
        this.roomId = null
        this.adminId = null
        this.players = []
        this.gameMode = 'normal'
        this.status = 'disconnected'
        break
      case 'game_started':
        this.gameStarted = true
        this.gameState = msg.state
        break
      case 'game_state':
        this.gameState = msg.state
        break
      case 'face_up_set':
        // game_state is broadcast alongside this — no extra state needed
        break
      case 'face_down_revealed':
        this.peekedFdId = msg.fdId
        this.peekedCard = msg.card
        break
      case 'lobby_reset':
        this.gameStarted = false
        this.gameState = null
        this.peekedFdId = null
        this.peekedCard = null
        break
      case 'error':
        this.error = msg.message
        if (!this.playerId) sessionStorage.removeItem(SESSION_KEY)
        break
    }
  }

  #send(msg: ClientMessage): void {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg))
    }
  }

  kickPlayer(playerId: string): void {
    this.#send({ type: 'kick_player', playerId })
  }

  setGameMode(mode: GameMode): void {
    this.#send({ type: 'set_game_mode', mode })
  }

  startGame(): void {
    this.#send({ type: 'start_game' })
  }

  setFaceUp(cardIds: string[]): void {
    this.#send({ type: 'set_face_up', cardIds })
  }

  playCard(cardIds: string[]): void {
    this.#send({ type: 'play_card', cardIds })
  }

  throwIn(cardIds: string[]): void {
    this.#send({ type: 'throw_in_card', cardIds })
  }

  pickUpPile(): void {
    this.#send({ type: 'pick_up_pile' })
  }

  peekFaceDown(fdId: string): void {
    this.#send({ type: 'peek_face_down', fdId })
  }

  returnToLobby(): void {
    this.#send({ type: 'return_to_lobby' })
  }

  clearPeek(): void {
    this.peekedFdId = null
    this.peekedCard = null
  }

  tryRestoreSession(): boolean {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return false
    try {
      const { playerName, roomId } = JSON.parse(raw) as { playerName: string; roomId: string }
      if (playerName && roomId) {
        this.connect(playerName, roomId)
        return true
      }
    } catch { /* ignore */ }
    sessionStorage.removeItem(SESSION_KEY)
    return false
  }

  disconnect(): void {
    sessionStorage.removeItem(SESSION_KEY)
    this.#ws?.close()
    this.#ws = null
    this.playerId = null
    this.roomId = null
    this.adminId = null
    this.players = []
    this.gameMode = 'normal'
    this.gameStarted = false
    this.gameState = null
    this.peekedFdId = null
    this.peekedCard = null
    this.status = 'disconnected'
  }
}

export const connection = new GameConnection()
