# Architecture

## Overview

Shithead Online is a real-time multiplayer card game built as a monorepo with:

- **`shared/`** — Deno package with shared TypeScript types used by both client and server
- **`server/`** — Deno + Hono backend serving REST and WebSocket endpoints
- **`client/`** — Svelte 5 + Vite SPA

## Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Svelte 5, Vite 6, TypeScript        |
| Backend   | Deno, Hono 4                        |
| Real-time | WebSockets (native Deno + Hono)     |
| Container | Docker, nginx (client reverse proxy)|

## Directory Structure

```
shithead-online/
├── shared/          # Shared types (Deno package)
├── server/          # Hono API + WebSocket server
└── client/          # Svelte 5 SPA
```

## Dev Commands

```bash
# Server (Deno, port 8000)
cd server && deno task dev

# Client (Vite, port 5173)
cd client && npm install && npm run dev

# Full stack via Docker
docker compose up --build
```
