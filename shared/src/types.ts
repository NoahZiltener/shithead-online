// Client → Server messages
export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join'; roomId: string; playerName: string }
  | { type: 'start_game' }
  | { type: 'play_card'; cardIds: string[] }
  | { type: 'pick_up_pile' }

// Server → Client messages
export type ServerMessage =
  | { type: 'room_created'; playerId: string; roomId: string }
  | { type: 'joined'; playerId: string; roomId: string; adminId: string; players: { id: string; name: string }[] }
  | { type: 'player_joined'; playerId: string; playerName: string }
  | { type: 'player_left'; playerId: string }
  | { type: 'admin_changed'; adminId: string }
  | { type: 'game_started' }
  | { type: 'error'; message: string }
