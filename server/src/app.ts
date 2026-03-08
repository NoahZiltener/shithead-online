import { Hono } from 'hono'
import { createRoomStore, type RoomStore } from './rooms.ts'
import { createWsHandler } from './ws.ts'

export function createApp(store: RoomStore = createRoomStore()): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.get('/ws', createWsHandler(store))

  return app
}
