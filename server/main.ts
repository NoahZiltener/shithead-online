import { configure, getConsoleSink } from '@logtape/logtape'
import { createApp } from './src/app.ts'

await configure({
  sinks: {
    console: getConsoleSink(),
  },
  loggers: [
    { category: ['shithead-online'], sinks: ['console'], lowestLevel: 'info' },
  ],
})

Deno.serve(createApp().fetch)
