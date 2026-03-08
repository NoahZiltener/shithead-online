import type { ClientMessage, ServerMessage } from '$shared/types.ts'

type Player = { id: string; name: string }

class GameConnection {
  status = $state<'disconnected' | 'connecting' | 'connected'>('disconnected')
  playerId = $state<string | null>(null)
  roomId = $state<string | null>(null)
  adminId = $state<string | null>(null)
  isAdmin = $derived(this.playerId !== null && this.playerId === this.adminId)
  players = $state<Player[]>([])
  gameStarted = $state(false)
  error = $state<string | null>(null)

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
        this.players = [{ id: msg.playerId, name: this.#myName }]
        break
      case 'joined':
        this.playerId = msg.playerId
        this.roomId = msg.roomId
        this.adminId = msg.adminId
        this.players = msg.players
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
      case 'game_started':
        this.gameStarted = true
        break
      case 'error':
        this.error = msg.message
        break
    }
  }

  #send(msg: ClientMessage): void {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg))
    }
  }

  startGame(): void {
    this.#send({ type: 'start_game' })
  }

  disconnect(): void {
    this.#ws?.close()
    this.#ws = null
    this.playerId = null
    this.roomId = null
    this.adminId = null
    this.players = []
    this.gameStarted = false
    this.status = 'disconnected'
  }
}

export const connection = new GameConnection()
