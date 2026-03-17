import { configure, getConsoleSink } from '@logtape/logtape'
import { createApp } from './src/app.ts'
import { discordAlertsSink } from './src/discord.ts'

await configure({
  sinks: {
    console: getConsoleSink(),
    discord: discordAlertsSink,
  },
  loggers: [
    { category: ['shithead-online'], sinks: ['console', 'discord'], lowestLevel: 'info' },
  ],
})

Deno.serve(createApp().fetch)
