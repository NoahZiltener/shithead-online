# Copilot Instructions — shithead-online

## Project Overview

Shithead Online is a real-time multiplayer card game. This is a **monorepo** with three packages:

| Package    | Runtime      | Purpose                                    |
|------------|------|---------|
| `shared/`  | Deno | Shared TypeScript types and game logic |
| `server/`  | Deno + Hono | REST API + WebSocket server |
| `client/`  | Node + Vite | Svelte 5 SPA (single-page app) |

## Key Architecture Decisions

- **Game logic in `shared/src/`** — Imported by server (authoritative) and optionally by client for validation
- **Server is authoritative** — Client is display only; all game state changes validated server-side
- **WebSocket protocol** — Messages use typed envelopes from `shared/src/types.ts` (ClientMessage and ServerMessage unions)
- **Per-room management** — Server maintains connection sets per room; broadcasts state changes to all clients in the room

## Build, Test, and Lint

### Server (Deno + Hono)
```bash
cd server

# Development (hot-reload, port 8000)
deno task dev

# Run all tests
deno task test

# Run a single test file
deno test --allow-net --allow-env tests/filename.ts

# Lint
deno task lint

# Format
deno task fmt

# Type-check
deno task check

# Production start
deno task start
```

### Client (Vite + Svelte 5)
```bash
cd client

# Install dependencies (required once)
npm install

# Development (hot-reload, port 5173)
npm run dev

# Type-check (svelte-check)
npm run typecheck

# Build for production
npm run build

# End-to-end tests (Playwright)
npm run e2e

# E2E tests in UI mode (interactive)
npm run e2e:ui
```

### Shared (Deno)
```bash
cd shared

# Run tests
deno task test

# Type-check
deno task check

# Lint
deno task lint

# Format
deno task fmt
```

### Full Stack
```bash
# Docker (runs server + client + nginx reverse proxy)
docker compose up --build
# → Client: http://localhost:80
# → Server: http://localhost:8000 (internal, proxied)
```

## Development Proxy

During development, Vite automatically proxies:
- `/ws` → `ws://localhost:8000/ws` (WebSocket)
- `/api` → `http://localhost:8000/api` (REST calls)

In production, nginx handles these proxies.

## Key Files and Modules

**Server:**
- `src/app.ts` — Hono app factory (REST endpoints, WebSocket setup)
- `src/ws.ts` — WebSocket connection and message routing
- `src/rooms.ts` — Room state and connection management
- `src/game/` — Game logic modules:
  - `types.ts` — Internal server game state types
  - `deck.ts` — Deck creation and shuffling
  - `setup.ts` — Game initialization and face-up setup
  - `play.ts` — Turn logic and card play validation
  - `rules.ts` — Game rules and win conditions
  - `view.ts` — Converts server state to ClientGameState (per-player)
- `src/discord.ts` — Alert sink for logging errors to Discord

**Client:**
- `src/App.svelte` — Root component
- `e2e/` — Playwright end-to-end tests
- `nginx.conf` — Reverse proxy configuration for Docker

**Shared:**
- `src/types.ts` — Game types (Card, GameMode, ClientGameState, ClientMessage, ServerMessage)

## Conventions

1. **TypeScript everywhere** — Use strict typing; leverage union types for WebSocket messages
2. **No state mutations in shared game logic** — Game state functions should be pure; return new state objects
3. **Client message handling** — All ClientMessages defined in `shared/src/types.ts`; server validates and rejects invalid moves
4. **Card visibility** — Face-down cards stored with opaque IDs (e.g., `'fd_0'`) in client view; rank/suit only known server-side
5. **Logging** — Server uses `@logtape/logtape` with console and Discord sinks; errors auto-alert via Discord
6. **Opaque IDs for face-down cards** — Client never sees the actual rank/suit, only the server
7. **Game phases** — 'setup' → 'playing' → 'finished' (enforced server-side)

## Testing Strategy

- **Server unit tests** — Test game logic in `server/tests/`
- **Shared tests** — Test game rules and types in `shared/` (if added)
- **Client E2E tests** — Playwright tests in `client/e2e/` (test full workflows)

## Environment Variables

The server reads `.env` at development time (specified in `deno task dev`). Key variables are used for Discord alerts (`DISCORD_WEBHOOK_URL`) and other configuration.
