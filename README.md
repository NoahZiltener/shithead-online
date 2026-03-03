# shithead-online
An online multiplayer version of the classic card game Shithead.

## Local Development

**Prerequisites:** [Deno](https://deno.com/) and [Node.js](https://nodejs.org/)

Run the server and client in separate terminals:

```bash
# Terminal 1 — server (http://localhost:8000)
cd server && deno task dev

# Terminal 2 — client (http://localhost:5173)
cd client && npm install && npm run dev
```

Alternatively, run the full stack with Docker:

```bash
docker compose up --build
# → client: http://localhost:80
```
