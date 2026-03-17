import { assertEquals } from '@std/assert'
import { configureSync, getConsoleSink } from '@logtape/logtape'
import { createApp } from '../../src/app.ts'

configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ['shithead-online'], sinks: ['console'], lowestLevel: 'debug' },
  ],
})

Deno.test('GET /health returns ok', async () => {
  const res = await createApp().request('/health')
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { status: 'ok' })
})
