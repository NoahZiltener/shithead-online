export type GameMode = 'normal' | 'double_deck'

// Client → Server messages
export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join'; roomId: string; playerName: string }
  | { type: 'set_game_mode'; mode: GameMode }
  | { type: 'kick_player'; playerId: string }
  | { type: 'start_game' }
  | { type: 'play_card'; cardIds: string[] }
  | { type: 'pick_up_pile' }

// Server → Client messages
export type ServerMessage =
  | { type: 'room_created'; playerId: string; roomId: string; gameMode: GameMode }
  | { type: 'joined'; playerId: string; roomId: string; adminId: string; players: { id: string; name: string }[]; gameMode: GameMode }
  | { type: 'player_joined'; playerId: string; playerName: string }
  | { type: 'player_left'; playerId: string }
  | { type: 'admin_changed'; adminId: string }
  | { type: 'game_mode_changed'; mode: GameMode }
  | { type: 'kicked' }
  | { type: 'game_started' }
  | { type: 'error'; message: string }
