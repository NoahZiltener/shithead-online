export type GameMode = 'normal' | 'double_deck'

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

// Jack=11, Queen=12, King=13, Ace=14. Special: 2, 3, 7, 8, 10
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface Card {
  id: string
  suit: Suit
  rank: Rank
}

export type PileConstraint = 'none' | 'after2' | 'after7'

export type GamePhase = 'setup' | 'playing' | 'finished'

// What a player sees about themselves
export interface SelfView {
  id: string
  name: string
  hand: Card[]
  faceUp: Card[]
  faceDownCount: number
  faceDownIds: string[] // opaque IDs like 'fd_0', 'fd_1', 'fd_2' — rank/suit unknown
  isFinished: boolean
  hasSetFaceUp: boolean
}

// What a player sees about opponents
export interface OpponentView {
  id: string
  name: string
  handCount: number
  faceUp: Card[]
  faceDownCount: number
  isFinished: boolean
}

// Client-visible game state (personalised per player)
export interface ClientGameState {
  self: SelfView
  opponents: OpponentView[]
  drawPileCount: number
  discardPile: Card[]
  effectiveTop: Card | null
  constraint: PileConstraint
  currentPlayerId: string | null
  phase: GamePhase
  finishedPlayerIds: string[]
  loser?: string
}

// Client → Server messages
export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join'; roomId: string; playerName: string }
  | { type: 'set_game_mode'; mode: GameMode }
  | { type: 'kick_player'; playerId: string }
  | { type: 'start_game' }
  | { type: 'set_face_up'; cardIds: string[] }
  | { type: 'play_card'; cardIds: string[] }
  | { type: 'pick_up_pile' }
  | { type: 'peek_face_down'; fdId: string }
  | { type: 'return_to_lobby' }

// Server → Client messages
export type ServerMessage =
  | { type: 'room_created'; playerId: string; roomId: string; gameMode: GameMode }
  | { type: 'joined'; playerId: string; roomId: string; adminId: string; players: { id: string; name: string }[]; gameMode: GameMode }
  | { type: 'player_joined'; playerId: string; playerName: string }
  | { type: 'player_left'; playerId: string }
  | { type: 'admin_changed'; adminId: string }
  | { type: 'game_mode_changed'; mode: GameMode }
  | { type: 'kicked' }
  | { type: 'game_started'; state: ClientGameState }
  | { type: 'game_state'; state: ClientGameState }
  | { type: 'face_up_set'; playerId: string; allReady: boolean }
  | { type: 'face_down_revealed'; fdId: string; card: Card }
  | { type: 'lobby_reset' }
  | { type: 'error'; message: string }
