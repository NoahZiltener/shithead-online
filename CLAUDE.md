# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An online multiplayer implementation of the card game Shithead.

## Architecture

**Monorepo** with three packages:

| Package    | Runtime      | Purpose                              |
|------------|--------------|--------------------------------------|
| `shared/`  | Deno         | Shared TypeScript types              |
| `server/`  | Deno + Hono  | REST API + WebSocket server          |
| `client/`  | Node + Vite  | Svelte 5 SPA                         |

See `docs/architecture.md` for full details.

## Dev Commands

```bash
# Server (port 8000, hot-reload)
cd server && deno task dev

# Client (port 5173, hot-reload)
cd client && npm install && npm run dev

# Full stack via Docker
docker compose up --build
```

## Other Commands

```bash
# Server
deno task test    # Run tests
deno task lint    # Lint
deno task fmt     # Format
deno task check   # Type-check

# Client
npm run test      # Vitest
npm run typecheck # svelte-check
npm run build     # Production build
```

## Key Files

- `server/src/main.ts` — Hono app entrypoint (health endpoint + WS echo)
- `client/src/App.svelte` — Root Svelte component
- `shared/src/types.ts` — Shared game types (to be populated)
- `client/nginx.conf` — nginx config for Docker (SPA + proxy)
- `docker-compose.yml` — Compose config for full-stack Docker run

## Conventions

- Game logic goes in `shared/src/` (imported by server as authoritative source)
- Server is the authoritative game state; client is display only
- WebSocket messages will use typed envelopes defined in `shared/src/types.ts`
