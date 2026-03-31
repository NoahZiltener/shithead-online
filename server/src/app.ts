import { Hono } from 'hono'
import { createRoomStore, type RoomStore } from './rooms.ts'
import { createWsHandler } from './ws.ts'

const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') ??
  'https://discord.com/api/webhooks/1488479251240980562/4Eyg60rKKe1UJtFR7SEsoy0LisPnvYkLVu9e9hCtJQ3jePSiZIgm4ofL6-hyakTlwiiE'

export function createApp(store: RoomStore = createRoomStore()): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.get('/ws', createWsHandler(store))

  app.post('/api/feedback', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return c.json({ error: 'message is required' }, 400)
    }

    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Anonymous'
    const info = body.clientInfo as Record<string, string | null> | undefined

    const fields = []
    if (info) {
      if (info.currentScreen) fields.push({ name: 'Screen', value: info.currentScreen, inline: true })
      if (info.roomCode)      fields.push({ name: 'Room', value: info.roomCode, inline: true })
      if (info.screen)        fields.push({ name: 'Resolution', value: info.screen, inline: true })
      if (info.timestamp)     fields.push({ name: 'Time', value: new Date(info.timestamp).toUTCString(), inline: false })
      if (info.userAgent)     fields.push({ name: 'User Agent', value: info.userAgent, inline: false })
    }

    const payload = {
      embeds: [{
        title: `Feedback from ${name}`,
        description: body.message.trim(),
        color: 0xf72585,
        fields,
      }],
    }

    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      return c.json({ error: 'Failed to send feedback' }, 502)
    }

    return c.json({ ok: true })
  })

  return app
}
