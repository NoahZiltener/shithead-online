# WebSocket Protocol

**Endpoint:** `ws://localhost:8000/ws`

All messages are JSON objects with a `type` field. The client sends **Client → Server** messages; the server sends **Server → Client** messages.

---

## Connection lifecycle

```
Client connects
  → Client sends create_room or join
  → Server responds with room_created or joined (or error)
  → [lobby phase: players join, host configures]
  → Host sends start_game
  → Server sends game_started to each player (personalised state)
  → [game phase: players take turns]
  → Server sends game_state after every state change
Client disconnects
  → Server broadcasts player_left
  → If host disconnected: server broadcasts admin_changed
```

---

## Client → Server messages

### `create_room`

Creates a new room and joins it as the host.

```json
{ "type": "create_room", "playerName": "Alice" }
```

| Field        | Type   | Description        |
|--------------|--------|--------------------|
| `playerName` | string | Display name       |

**Response:** [`room_created`](#room_created)

---

### `join`

Joins an existing room by its code.

```json
{ "type": "join", "roomId": "ABC123", "playerName": "Bob" }
```

| Field        | Type   | Description              |
|--------------|--------|--------------------------|
| `roomId`     | string | 6-character room code    |
| `playerName` | string | Display name             |

**Response:** [`joined`](#joined), then [`player_joined`](#player_joined) broadcast to others.

---

### `set_game_mode`

Changes the game mode. **Host only.**

```json
{ "type": "set_game_mode", "mode": "double_deck" }
```

| Field  | Type                        | Description               |
|--------|-----------------------------|---------------------------|
| `mode` | `"normal"` \| `"double_deck"` | `normal` = max 5 players, `double_deck` = max 10 |

**Broadcast:** [`game_mode_changed`](#game_mode_changed) to all players.

---

### `kick_player`

Removes a player from the room. **Host only.**

```json
{ "type": "kick_player", "playerId": "<uuid>" }
```

| Field      | Type   | Description              |
|------------|--------|--------------------------|
| `playerId` | string | UUID of player to remove |

**Effects:** [`kicked`](#kicked) sent to target; [`player_left`](#player_left) broadcast to others.

---

### `start_game`

Starts the game. **Host only.** Requires ≥ 2 players.

```json
{ "type": "start_game" }
```

**Response:** [`game_started`](#game_started) sent to each player individually with personalised state.

---

### `set_face_up`

During the **setup phase**, select exactly 3 cards from your hand to place face-up.

```json
{ "type": "set_face_up", "cardIds": ["c_01", "c_07", "c_22"] }
```

| Field     | Type       | Description                             |
|-----------|------------|-----------------------------------------|
| `cardIds` | `string[]` | Exactly 3 card IDs from your hand       |

**Broadcast:** [`face_up_set`](#face_up_set) + [`game_state`](#game_state) to all players.
Once all players have set their face-up cards, the phase advances to `playing`.

---

### `play_card`

During the **playing phase**, play one or more cards of the same rank from your current active pile (hand → face-up → face-down).

```json
{ "type": "play_card", "cardIds": ["c_03", "c_18"] }
```

| Field     | Type       | Description                                         |
|-----------|------------|-----------------------------------------------------|
| `cardIds` | `string[]` | One or more card IDs, all must be the same rank     |

Face-down cards are referenced by their opaque IDs (`"fd_0"`, `"fd_1"`, `"fd_2"`).

**Broadcast:** [`game_state`](#game_state) to all players.

---

### `pick_up_pile`

During the **playing phase**, pick up the entire discard pile into your hand (used when you cannot legally play).

```json
{ "type": "pick_up_pile" }
```

**Broadcast:** [`game_state`](#game_state) to all players.

---

## Server → Client messages

### `room_created`

Sent to the player who created a room.

```json
{
  "type": "room_created",
  "playerId": "<uuid>",
  "roomId": "ABC123",
  "gameMode": "normal"
}
```

| Field      | Type     | Description                   |
|------------|----------|-------------------------------|
| `playerId` | string   | Your assigned UUID            |
| `roomId`   | string   | 6-character room code to share|
| `gameMode` | GameMode | Initial mode (`"normal"`)     |

---

### `joined`

Sent to a player who successfully joined a room.

```json
{
  "type": "joined",
  "playerId": "<uuid>",
  "roomId": "ABC123",
  "adminId": "<uuid>",
  "players": [
    { "id": "<uuid>", "name": "Alice" },
    { "id": "<uuid>", "name": "Bob" }
  ],
  "gameMode": "normal"
}
```

| Field      | Type                           | Description                   |
|------------|--------------------------------|-------------------------------|
| `playerId` | string                         | Your assigned UUID            |
| `roomId`   | string                         | Room code                     |
| `adminId`  | string                         | UUID of the current host      |
| `players`  | `{ id: string; name: string }[]` | All players currently in room |
| `gameMode` | GameMode                       | Current game mode             |

---

### `player_joined`

Broadcast to all players already in the room when someone new joins.

```json
{ "type": "player_joined", "playerId": "<uuid>", "playerName": "Carol" }
```

---

### `player_left`

Broadcast when a player disconnects or is kicked.

```json
{ "type": "player_left", "playerId": "<uuid>" }
```

---

### `admin_changed`

Broadcast when the host disconnects and the host role is transferred to the next player.

```json
{ "type": "admin_changed", "adminId": "<uuid>" }
```

---

### `game_mode_changed`

Broadcast to all players when the host changes the game mode.

```json
{ "type": "game_mode_changed", "mode": "double_deck" }
```

---

### `kicked`

Sent only to the player who was kicked.

```json
{ "type": "kicked" }
```

---

### `game_started`

Sent individually to each player when the game begins. Contains personalised state.

```json
{ "type": "game_started", "state": { ...ClientGameState } }
```

See [ClientGameState](#clientgamestate) below.

---

### `game_state`

Broadcast (individually personalised) after every game action.

```json
{ "type": "game_state", "state": { ...ClientGameState } }
```

See [ClientGameState](#clientgamestate) below.

---

### `face_up_set`

Broadcast when a player completes their face-up selection during setup.

```json
{ "type": "face_up_set", "playerId": "<uuid>", "allReady": false }
```

| Field      | Type    | Description                                        |
|------------|---------|----------------------------------------------------|
| `playerId` | string  | Player who just set their face-up cards            |
| `allReady` | boolean | `true` if all players are ready (phase → playing)  |

---

### `error`

Sent to the requesting player when an action fails.

```json
{ "type": "error", "message": "Not your turn." }
```

---

## Data types

### `ClientGameState`

Personalised per-player view of the game state.

```ts
{
  self: SelfView
  opponents: OpponentView[]
  drawPileCount: number       // cards remaining in the draw pile
  discardPile: Card[]         // full discard pile, top = last element
  effectiveTop: Card | null   // top non-3 card (determines what can be played)
  constraint: PileConstraint  // current play constraint
  currentPlayerId: string | null
  phase: GamePhase
  finishedPlayerIds: string[] // players who have played all their cards, in order
  loser?: string              // playerId of the shithead (only set when phase = "finished")
}
```

### `SelfView`

```ts
{
  id: string
  name: string
  hand: Card[]
  faceUp: Card[]
  faceDownCount: number
  faceDownIds: string[]   // opaque: "fd_0", "fd_1", "fd_2" — rank/suit hidden until played
  isFinished: boolean
  hasSetFaceUp: boolean
}
```

### `OpponentView`

```ts
{
  id: string
  name: string
  handCount: number       // number of cards in hand (not revealed)
  faceUp: Card[]
  faceDownCount: number
  isFinished: boolean
}
```

### `Card`

```ts
{
  id: string
  suit: "clubs" | "diamonds" | "hearts" | "spades"
  rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14
  //    2   3   4   5   6   7   8   9   10   J    Q    K    A
}
```

### `PileConstraint`

| Value     | Meaning                                   |
|-----------|-------------------------------------------|
| `"none"`  | Any card ≥ effective top can be played    |
| `"after2"`| Any card except 7 can be played (after a 2) |
| `"after7"`| Only cards ≤ 7 can be played (after a 7) |

### `GamePhase`

| Value        | Meaning                                           |
|--------------|---------------------------------------------------|
| `"setup"`    | Players are choosing their 3 face-up cards        |
| `"playing"`  | Normal gameplay                                   |
| `"finished"` | Game over — `loser` field identifies the shithead |

### `GameMode`

| Value           | Max players | Decks |
|-----------------|-------------|-------|
| `"normal"`      | 5           | 1     |
| `"double_deck"` | 10          | 2     |

---

## Special card effects

| Rank | Effect                                                             |
|------|--------------------------------------------------------------------|
| 2    | Always playable. Next constraint becomes `after2` (anything but 7)|
| 3    | Always playable. Transparent — effective top is unchanged         |
| 7    | Always playable. Next constraint becomes `after7` (≤ 7 only)     |
| 8    | Always playable. Skips the next player's turn                     |
| 10   | Always playable. Burns the pile (discard pile cleared, play again)|
| Any four of a kind | Burns the pile regardless of rank                       |
