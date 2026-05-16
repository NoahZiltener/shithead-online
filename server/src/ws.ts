import { upgradeWebSocket } from "hono/deno";
import type { WSContext } from "hono/ws";
import { getLogger } from "@logtape/logtape";
import type {
  BotDifficulty,
  ClientMessage,
  GameMode,
  ServerMessage,
} from "../../shared/src/types.ts";
import { chooseBotAction } from "./game/bot.ts";
import {
  dealCards,
  getClientState,
  pickUpPile,
  playCards,
  setFaceUp,
  throwInCards,
} from "./game/index.ts";
import {
  addBotSeat,
  addHumanSeat,
  createRoom,
  getPlayerSummaries,
  getRoom,
  getSeat,
  MAX_PLAYERS,
  removeBotSeat,
  removePlayer,
  type Room,
  type RoomStore,
} from "./rooms.ts";
import { sendGameSummary } from "./discord.ts";
import { addChatMessage, getChatHistory } from "./chat.ts";

const logger = getLogger(["shithead-online", "ws"]);
const VALID_BOT_DIFFICULTIES = new Set<BotDifficulty>([
  "easy",
  "medium",
  "hard",
]);

function send(ws: WSContext, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMessage, excludeId?: string): void {
  const json = JSON.stringify(msg);
  for (const [id, player] of room.players) {
    if (id !== excludeId) player.ws.send(json);
  }
}

function broadcastGameState(room: Room): void {
  if (!room.gameState) return;
  for (const [id, player] of room.players) {
    const state = getClientState(room.gameState, id);
    player.ws.send(
      JSON.stringify({ type: "game_state", state } satisfies ServerMessage),
    );
  }
}

const VALID_MODES = new Set<GameMode>(["normal", "double_deck"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBotDifficulty(room: Room, playerId: string): BotDifficulty | null {
  const seat = getSeat(room, playerId);
  if (!seat || seat.kind !== "bot") return null;
  return seat.difficulty;
}

async function runBotTurns(room: Room): Promise<void> {
  if (room.botTurnRunning) return;
  if (room.players.size === 0) return;

  const MAX_BOT_ACTIONS_PER_CYCLE = 50;
  let hadError = false;

  room.botTurnRunning = true;
  try {
    for (let i = 0; i < MAX_BOT_ACTIONS_PER_CYCLE; i++) {
      if (!room.gameState) break;
      if (room.players.size === 0) break;

      if (room.gameState.phase === "setup") {
        const botsToSet = room.gameState.players.filter((p) => {
          if (p.hasSetFaceUp) return false;
          return getBotDifficulty(room, p.id) !== null;
        });
        if (botsToSet.length === 0) break;

        for (const bot of botsToSet) {
          if (!room.gameState || room.gameState.phase !== "setup") break;
          const difficulty = getBotDifficulty(room, bot.id);
          if (!difficulty) continue;
          const action = chooseBotAction(room.gameState, bot.id, difficulty);
          if (action.type !== "set_face_up") continue;

          room.gameState = setFaceUp(room.gameState, bot.id, action.cardIds);
          const allReady = room.gameState.phase === "playing";
          broadcast(room, { type: "face_up_set", playerId: bot.id, allReady });
          broadcastGameState(room);
          await sleep(350);
        }
        continue;
      }

      if (room.gameState.phase !== "playing") break;
      const activePlayers = room.gameState.players.filter((p) => !p.isFinished);
      if (activePlayers.length <= 1) {
        room.gameState = {
          ...room.gameState,
          phase: "finished",
          loser: activePlayers[0]?.id,
        };
        broadcastGameState(room);
        sendGameSummary(
          room.id,
          room.gameMode,
          room.gameState,
          room.gameStartedAt ?? Date.now(),
        );
        break;
      }

      let currentPlayer =
        room.gameState.players[room.gameState.currentPlayerIndex];
      if (currentPlayer.isFinished) {
        const n = room.gameState.players.length;
        let next = (room.gameState.currentPlayerIndex + 1) % n;
        let attempts = 0;
        while (room.gameState.players[next].isFinished && attempts < n) {
          next = (next + 1) % n;
          attempts++;
        }
        room.gameState = { ...room.gameState, currentPlayerIndex: next };
        broadcastGameState(room);
        continue;
      }

      const difficulty = getBotDifficulty(room, currentPlayer.id);
      if (!difficulty) break;

      const action = chooseBotAction(
        room.gameState,
        currentPlayer.id,
        difficulty,
      );
      if (action.type === "pick_up_pile") {
        room.gameState = pickUpPile(room.gameState, currentPlayer.id);
        broadcastGameState(room);
        await sleep(450);
        continue;
      }

      const result = playCards(
        room.gameState,
        currentPlayer.id,
        action.cardIds,
      );
      room.gameState = result.state;
      broadcastGameState(room);
      if (result.gameOver) {
        sendGameSummary(
          room.id,
          room.gameMode,
          result.state,
          room.gameStartedAt ?? Date.now(),
        );
        break;
      }
      await sleep(450);
    }
  } catch (error) {
    hadError = true;
    logger.error("Bot turn execution failed in room {roomId}: {error}", {
      roomId: room.id,
      error: (error as Error).message,
    });
    if (room.players.size > 0) {
      broadcast(room, {
        type: "error",
        message: "Bot action failed. Please continue manually.",
      });
    }
  } finally {
    room.botTurnRunning = false;
    if (hadError) return;
    if (!room.gameState || room.gameState.phase !== "playing") return;
    if (room.players.size === 0) return;

    const currentPlayer =
      room.gameState.players[room.gameState.currentPlayerIndex];
    if (getBotDifficulty(room, currentPlayer.id) !== null) {
      // Continue bot-only stretches in the next scheduler slice instead of stalling at cycle limit.
      setTimeout(() => void runBotTurns(room), 50);
    }
  }
}

export function createWsHandler(store: RoomStore) {
  return upgradeWebSocket(() => {
    let room: Room | null = null;
    let playerId: string | null = null;

    return {
      onMessage(evt, ws) {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(evt.data as string);
        } catch {
          logger.warn("Received invalid JSON from player {playerId}", {
            playerId,
          });
          send(ws, { type: "error", message: "Invalid JSON" });
          return;
        }

        if (msg.type === "create_room") {
          if (room && playerId) {
            broadcast(room, { type: "player_left", playerId });
            removePlayer(store, room, playerId);
          }
          playerId = crypto.randomUUID();
          room = createRoom(store);
          room.adminId = playerId;
          room.players.set(playerId, {
            id: playerId,
            name: msg.playerName,
            ws,
          });
          addHumanSeat(room, playerId, msg.playerName);
          logger.info("Player {playerName} created room {roomId}", {
            playerName: msg.playerName,
            playerId,
            roomId: room.id,
          });
          send(ws, {
            type: "room_created",
            playerId,
            roomId: room.id,
            gameMode: room.gameMode,
          });
          return;
        }

        if (msg.type === "join") {
          const target = getRoom(store, msg.roomId);
          if (!target) {
            logger.warn("Join failed: room {roomId} not found", {
              roomId: msg.roomId,
            });
            send(ws, {
              type: "error",
              message: `Room "${msg.roomId}" not found.`,
            });
            return;
          }
          if (target.seats.length >= MAX_PLAYERS[target.gameMode]) {
            logger.warn("Join failed: room {roomId} is full", {
              roomId: msg.roomId,
            });
            send(ws, { type: "error", message: "Room is full." });
            return;
          }
          if (room && playerId) {
            broadcast(room, { type: "player_left", playerId });
            removePlayer(store, room, playerId);
          }
          playerId = crypto.randomUUID();
          room = target;
          room.players.set(playerId, {
            id: playerId,
            name: msg.playerName,
            ws,
          });
          addHumanSeat(room, playerId, msg.playerName);
          logger.info("Player {playerName} joined room {roomId}", {
            playerName: msg.playerName,
            playerId,
            roomId: room.id,
          });
          const players = getPlayerSummaries(room);
          const chatHistory = getChatHistory(room);
          send(ws, {
            type: "joined",
            playerId,
            roomId: room.id,
            adminId: room.adminId,
            players,
            gameMode: room.gameMode,
            chatHistory,
          });
          broadcast(room, {
            type: "player_joined",
            playerId,
            playerName: msg.playerName,
          }, playerId);
          return;
        }

        if (!room || !playerId) {
          send(ws, {
            type: "error",
            message:
              'Not in a room. Send a "join" or "create_room" message first.',
          });
          return;
        }

        if (msg.type === "add_bot") {
          if (playerId !== room.adminId) {
            send(ws, { type: "error", message: "Only the host can add bots." });
            return;
          }
          if (room.gameState !== null) {
            send(ws, {
              type: "error",
              message: "Cannot add bots after the game has started.",
            });
            return;
          }
          if (!VALID_BOT_DIFFICULTIES.has(msg.difficulty)) {
            send(ws, { type: "error", message: "Invalid bot difficulty." });
            return;
          }
          if (room.seats.length >= MAX_PLAYERS[room.gameMode]) {
            send(ws, { type: "error", message: "Room is full." });
            return;
          }

          const bot = addBotSeat(room, msg.difficulty, msg.name);
          broadcast(room, {
            type: "player_joined",
            playerId: bot.id,
            playerName: bot.name,
            isBot: true,
            botDifficulty: bot.difficulty,
          });
          return;
        }

        if (msg.type === "remove_bot") {
          if (playerId !== room.adminId) {
            send(ws, {
              type: "error",
              message: "Only the host can remove bots.",
            });
            return;
          }
          if (room.gameState !== null) {
            send(ws, {
              type: "error",
              message: "Cannot remove bots after the game has started.",
            });
            return;
          }
          const seat = getSeat(room, msg.playerId);
          if (!seat) {
            send(ws, { type: "error", message: "Player not found." });
            return;
          }
          if (seat.kind !== "bot") {
            send(ws, { type: "error", message: "Target is not a bot." });
            return;
          }
          removeBotSeat(room, seat.id);
          broadcast(room, { type: "player_left", playerId: seat.id });
          return;
        }

        if (msg.type === "set_game_mode") {
          if (playerId !== room.adminId) {
            send(ws, {
              type: "error",
              message: "Only the host can change the game mode.",
            });
            return;
          }
          if (!VALID_MODES.has(msg.mode)) {
            send(ws, { type: "error", message: "Invalid game mode." });
            return;
          }
          if (room.seats.length > MAX_PLAYERS[msg.mode]) {
            send(ws, {
              type: "error",
              message: `Cannot switch to this mode: too many players (max ${
                MAX_PLAYERS[msg.mode]
              }).`,
            });
            return;
          }
          room.gameMode = msg.mode;
          broadcast(room, { type: "game_mode_changed", mode: msg.mode });
          return;
        }

        if (msg.type === "kick_player") {
          if (playerId !== room.adminId) {
            send(ws, {
              type: "error",
              message: "Only the host can kick players.",
            });
            return;
          }
          if (msg.playerId === playerId) {
            send(ws, { type: "error", message: "You cannot kick yourself." });
            return;
          }
          const target = room.players.get(msg.playerId);
          if (!target) {
            send(ws, { type: "error", message: "Player not found." });
            return;
          }
          target.ws.send(JSON.stringify({ type: "kicked" }));
          logger.info("Player {targetId} was kicked from room {roomId}", {
            targetId: msg.playerId,
            roomId: room.id,
            byPlayerId: playerId,
          });
          removePlayer(store, room, msg.playerId);
          broadcast(room, { type: "player_left", playerId: msg.playerId });
          return;
        }

        if (msg.type === "start_game") {
          if (playerId !== room.adminId) {
            send(ws, {
              type: "error",
              message: "Only the host can start the game.",
            });
            return;
          }
          if (room.seats.length < 2) {
            send(ws, {
              type: "error",
              message: "Need at least 2 players to start.",
            });
            return;
          }
          if (room.gameState !== null) {
            send(ws, { type: "error", message: "Game already started." });
            return;
          }

          const players = room.seats.map((p) => ({ id: p.id, name: p.name }));
          room.gameState = dealCards(players, room.gameMode === "double_deck");
          room.gameStartedAt = Date.now();
          logger.info(
            "Game started in room {roomId} with {playerCount} players",
            { roomId: room.id, playerCount: players.length },
          );

          // Send each player their personalised initial state
          for (const [pid, conn] of room.players) {
            const state = getClientState(room.gameState, pid);
            conn.ws.send(
              JSON.stringify(
                { type: "game_started", state } satisfies ServerMessage,
              ),
            );
          }
          void runBotTurns(room);
          return;
        }

        // ── Chat (works before, during, and after game) ──────────────────────

        if (msg.type === "send_message") {
          const player = room.players.get(playerId);
          if (!player) {
            send(ws, { type: "error", message: "Player not found in room." });
            return;
          }

          const result = addChatMessage(room, playerId, player.name, msg.text);
          if (!result.success) {
            send(ws, {
              type: "error",
              message: result.error || "Failed to send message.",
            });
            return;
          }

          broadcast(room, { type: "chat_message", message: result.message! });
          return;
        }

        // ── Game actions ────────────────────────────────────────────────────

        if (!room.gameState) {
          send(ws, { type: "error", message: "Game has not started yet." });
          return;
        }

        if (msg.type === "set_face_up") {
          if (room.gameState.phase !== "setup") {
            send(ws, { type: "error", message: "Not in setup phase." });
            return;
          }
          const player = room.gameState.players.find((p) => p.id === playerId);
          if (!player) {
            send(ws, { type: "error", message: "Player not in game." });
            return;
          }
          if (player.hasSetFaceUp) {
            send(ws, {
              type: "error",
              message: "Already selected face-up cards.",
            });
            return;
          }

          try {
            room.gameState = setFaceUp(room.gameState, playerId, msg.cardIds);
          } catch (e) {
            send(ws, { type: "error", message: (e as Error).message });
            return;
          }

          const allReady = room.gameState.phase === "playing";
          broadcast(room, { type: "face_up_set", playerId, allReady });

          // Send updated game state to all (so everyone sees the face-up cards)
          broadcastGameState(room);
          void runBotTurns(room);
          return;
        }

        if (msg.type === "play_card") {
          if (room.gameState.phase !== "playing") {
            send(ws, {
              type: "error",
              message: "Game is not in playing phase.",
            });
            return;
          }

          let result;
          try {
            result = playCards(room.gameState, playerId, msg.cardIds);
          } catch (e) {
            send(ws, { type: "error", message: (e as Error).message });
            return;
          }

          room.gameState = result.state;
          broadcastGameState(room);
          if (result.gameOver) {
            sendGameSummary(
              room.id,
              room.gameMode,
              result.state,
              room.gameStartedAt ?? Date.now(),
            );
          }
          void runBotTurns(room);
          return;
        }

        if (msg.type === "throw_in_card") {
          if (room.gameState.phase !== "playing") {
            send(ws, {
              type: "error",
              message: "Game is not in playing phase.",
            });
            return;
          }

          let result;
          try {
            result = throwInCards(room.gameState, playerId, msg.cardIds);
          } catch (e) {
            send(ws, { type: "error", message: (e as Error).message });
            return;
          }

          room.gameState = result.state;
          broadcastGameState(room);
          if (result.gameOver) {
            sendGameSummary(
              room.id,
              room.gameMode,
              result.state,
              room.gameStartedAt ?? Date.now(),
            );
          }
          void runBotTurns(room);
          return;
        }

        if (msg.type === "pick_up_pile") {
          if (room.gameState.phase !== "playing") {
            send(ws, {
              type: "error",
              message: "Game is not in playing phase.",
            });
            return;
          }

          try {
            room.gameState = pickUpPile(room.gameState, playerId);
          } catch (e) {
            send(ws, { type: "error", message: (e as Error).message });
            return;
          }

          broadcastGameState(room);
          void runBotTurns(room);
          return;
        }

        if (msg.type === "peek_face_down") {
          if (room.gameState.phase !== "playing") {
            send(ws, { type: "error", message: "Not in playing phase." });
            return;
          }
          const gameState = room.gameState;
          const activePlayer = gameState.players[gameState.currentPlayerIndex];
          const requestingPlayer = gameState.players.find((p) =>
            p.id === playerId
          );
          if (!requestingPlayer) {
            send(ws, { type: "error", message: "Player not found." });
            return;
          }
          // On-turn: enforce face-down phase (hand must be empty)
          if (activePlayer.id === playerId) {
            const drawPileEmpty = gameState.drawPile.length === 0;
            const isInFaceDownPhase = requestingPlayer.hand.length === 0 &&
              !(drawPileEmpty && requestingPlayer.faceUp.length > 0);
            if (!isInFaceDownPhase) {
              send(ws, { type: "error", message: "Not in face-down phase." });
              return;
            }
          }
          // Off-turn: freely allow peeking own face-down cards for strategy review
          const fdMatch = msg.fdId.match(/^fd_(\d+)$/);
          if (!fdMatch) {
            send(ws, { type: "error", message: "Invalid face-down card ID." });
            return;
          }
          const fdIdx = parseInt(fdMatch[1], 10);
          if (fdIdx < 0 || fdIdx >= requestingPlayer.faceDown.length) {
            send(ws, {
              type: "error",
              message: "Invalid face-down card index.",
            });
            return;
          }
          send(ws, {
            type: "face_down_revealed",
            fdId: msg.fdId,
            card: requestingPlayer.faceDown[fdIdx],
          });
          return;
        }

        if (msg.type === "return_to_lobby") {
          if (!room.gameState || room.gameState.phase !== "finished") {
            send(ws, {
              type: "error",
              message: "Can only return to lobby after the game has finished.",
            });
            return;
          }
          room.gameState = null;
          broadcast(room, { type: "lobby_reset" });
          return;
        }
      },

      onClose() {
        if (!room || !playerId || !room.players.has(playerId)) {
          room = null;
          playerId = null;
          return;
        }
        if (room && playerId) {
          const wasAdmin = playerId === room.adminId;
          const disconnectedId = playerId;
          logger.info("Player {playerId} disconnected from room {roomId}", {
            playerId,
            roomId: room.id,
          });
          broadcast(room, { type: "player_left", playerId });
          removePlayer(store, room, disconnectedId);

          if (wasAdmin && room.players.size > 0) {
            const newAdmin = room.players.values().next().value!;
            room.adminId = newAdmin.id;
            logger.info(
              "Admin role transferred to {newAdminId} in room {roomId}",
              { newAdminId: newAdmin.id, roomId: room.id },
            );
            broadcast(room, { type: "admin_changed", adminId: newAdmin.id });
          }

          // Handle mid-game disconnect (setup phase)
          if (room.gameState && room.gameState.phase === "setup") {
            const gamePlayerIdx = room.gameState.players.findIndex((p) =>
              p.id === disconnectedId
            );
            if (gamePlayerIdx !== -1) {
              const player = room.gameState.players[gamePlayerIdx];
              // Auto-assign face-up cards if not already done (pick first 3 from hand)
              const newFaceUp = player.hasSetFaceUp
                ? player.faceUp
                : player.hand.slice(0, 3);
              const newHand = player.hasSetFaceUp
                ? player.hand
                : player.hand.slice(3);
              const newPlayers = room.gameState.players.map((p, i) =>
                i === gamePlayerIdx
                  ? {
                    ...p,
                    hand: newHand,
                    faceUp: newFaceUp,
                    hasSetFaceUp: true,
                    isFinished: true,
                  }
                  : p
              );
              const newFinished = [...room.gameState.finishedPlayerIds];
              if (!newFinished.includes(disconnectedId)) {
                newFinished.push(disconnectedId);
              }
              const activePlayers = newPlayers.filter((p) => !p.isFinished);

              if (activePlayers.length <= 1) {
                room.gameState = {
                  ...room.gameState,
                  players: newPlayers,
                  finishedPlayerIds: newFinished,
                  phase: "finished",
                  loser: activePlayers[0]?.id,
                };
                logger.info(
                  "Game ended in room {roomId} due to player {playerId} disconnecting during setup",
                  { roomId: room.id, playerId: disconnectedId },
                );
                sendGameSummary(
                  room.id,
                  room.gameMode,
                  room.gameState,
                  room.gameStartedAt ?? Date.now(),
                );
              } else {
                const allReady = activePlayers.every((p) => p.hasSetFaceUp);
                // Ensure currentPlayerIndex points to an active player when transitioning to playing
                let currentIdx = room.gameState.currentPlayerIndex;
                if (newPlayers[currentIdx]?.isFinished) {
                  const n = newPlayers.length;
                  let next = (currentIdx + 1) % n;
                  while (newPlayers[next].isFinished) next = (next + 1) % n;
                  currentIdx = next;
                }
                room.gameState = {
                  ...room.gameState,
                  players: newPlayers,
                  finishedPlayerIds: newFinished,
                  phase: allReady ? "playing" : "setup",
                  currentPlayerIndex: currentIdx,
                };
              }
              if (room.players.size > 0) {
                broadcastGameState(room);
                void runBotTurns(room);
              }
            }
          }

          // Handle mid-game disconnect (playing phase)
          if (room.gameState && room.gameState.phase === "playing") {
            const gamePlayerIdx = room.gameState.players.findIndex((p) =>
              p.id === disconnectedId
            );
            if (gamePlayerIdx !== -1) {
              const disconnectedPlayer = room.gameState.players[gamePlayerIdx];
              const newFinished = [...room.gameState.finishedPlayerIds];
              if (!newFinished.includes(disconnectedId)) {
                newFinished.push(disconnectedId);
              }
              const newPlayers = room.gameState.players.map((p) =>
                p.id === disconnectedId ? { ...p, isFinished: true } : p
              );
              const activePlayers = newPlayers.filter((p) => !p.isFinished);

              if (activePlayers.length <= 1) {
                const hadCards = disconnectedPlayer.hand.length > 0 ||
                  disconnectedPlayer.faceUp.length > 0 ||
                  disconnectedPlayer.faceDown.length > 0;
                room.gameState = {
                  ...room.gameState,
                  players: newPlayers,
                  finishedPlayerIds: newFinished,
                  phase: "finished",
                  loser: hadCards ? disconnectedId : activePlayers[0]?.id,
                };
                logger.info(
                  "Game ended in room {roomId} due to player {playerId} disconnecting",
                  { roomId: room.id, playerId: disconnectedId },
                );
                sendGameSummary(
                  room.id,
                  room.gameMode,
                  room.gameState,
                  room.gameStartedAt ?? Date.now(),
                );
              } else {
                // Continue with remaining players; advance turn if it was disconnected player's turn
                let currentIdx = room.gameState.currentPlayerIndex;
                if (currentIdx === gamePlayerIdx) {
                  const n = newPlayers.length;
                  let next = (currentIdx + 1) % n;
                  while (newPlayers[next].isFinished) next = (next + 1) % n;
                  currentIdx = next;
                }
                room.gameState = {
                  ...room.gameState,
                  players: newPlayers,
                  finishedPlayerIds: newFinished,
                  currentPlayerIndex: currentIdx,
                };
              }

              if (room.players.size > 0) {
                broadcastGameState(room);
                void runBotTurns(room);
              }
            }
          }

          room = null;
          playerId = null;
        }
      },
    };
  });
}
