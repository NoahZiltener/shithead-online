import { getLogger } from "@logtape/logtape";
import type {
  BotDifficulty,
  ChatMessage,
  GameMode,
  RoomPlayerSummary,
} from "../../shared/src/types.ts";
import type { ServerGameState } from "./game/index.ts";

const logger = getLogger(["shithead-online", "rooms"]);

export type { GameMode };

export interface Sender {
  send(data: string): void;
}

export type PlayerConn = {
  id: string;
  name: string;
  ws: Sender;
};

export type HumanRoomSeat = {
  id: string;
  name: string;
  kind: "human";
};

export type BotRoomSeat = {
  id: string;
  name: string;
  kind: "bot";
  difficulty: BotDifficulty;
};

export type RoomSeat = HumanRoomSeat | BotRoomSeat;

export type Room = {
  id: string;
  players: Map<string, PlayerConn>;
  seats: RoomSeat[];
  botTurnRunning: boolean;
  adminId: string;
  gameMode: GameMode;
  gameState: ServerGameState | null;
  gameStartedAt?: number;
  chatHistory: ChatMessage[];
};

export const MAX_PLAYERS: Record<GameMode, number> = {
  normal: 5,
  double_deck: 10,
};

export const MAX_CHAT_MESSAGES = 50;

export type RoomStore = Map<string, Room>;

export function createRoomStore(): RoomStore {
  return new Map();
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export function createRoom(store: RoomStore): Room {
  let id: string;
  do {
    id = generateRoomCode();
  } while (store.has(id));
  const room: Room = {
    id,
    players: new Map(),
    seats: [],
    botTurnRunning: false,
    adminId: "",
    gameMode: "normal",
    gameState: null,
    chatHistory: [],
  };
  store.set(id, room);
  logger.debug("Room {roomId} created", { roomId: id });
  return room;
}

export function getRoom(store: RoomStore, roomId: string): Room | undefined {
  return store.get(roomId);
}

export function addHumanSeat(
  room: Room,
  playerId: string,
  playerName: string,
): void {
  room.seats.push({ id: playerId, name: playerName, kind: "human" });
}

export function addBotSeat(
  room: Room,
  difficulty: BotDifficulty,
  name?: string,
): BotRoomSeat {
  const botCount = room.seats.filter((s) => s.kind === "bot").length + 1;
  const bot: BotRoomSeat = {
    id: `bot_${crypto.randomUUID()}`,
    name: name?.trim() || `Bot ${botCount}`,
    kind: "bot",
    difficulty,
  };
  room.seats.push(bot);
  return bot;
}

export function removeBotSeat(room: Room, botId: string): boolean {
  const idx = room.seats.findIndex((s) => s.id === botId && s.kind === "bot");
  if (idx === -1) return false;
  room.seats.splice(idx, 1);
  return true;
}

export function getSeat(room: Room, seatId: string): RoomSeat | undefined {
  return room.seats.find((s) => s.id === seatId);
}

export function getPlayerSummaries(room: Room): RoomPlayerSummary[] {
  return room.seats.map((s) =>
    s.kind === "bot"
      ? { id: s.id, name: s.name, isBot: true, botDifficulty: s.difficulty }
      : { id: s.id, name: s.name }
  );
}

export function removePlayer(
  store: RoomStore,
  room: Room,
  playerId: string,
): void {
  room.players.delete(playerId);
  room.seats = room.seats.filter((s) => s.id !== playerId);
  if (room.players.size === 0) {
    store.delete(room.id);
    logger.debug("Room {roomId} removed (empty)", { roomId: room.id });
  }
}
