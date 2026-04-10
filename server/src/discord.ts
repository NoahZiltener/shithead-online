import type { LogRecord } from '@logtape/logtape'
import type { ServerGameState } from './game/types.ts'

const GAME_WEBHOOK_URL = Deno.env.get('DISCORD_GAME_WEBHOOK_URL') ?? ''
const ALERTS_WEBHOOK_URL = Deno.env.get('DISCORD_ALERTS_WEBHOOK_URL') ?? ''

async function postWebhook(url: string, payload: unknown): Promise<void> {
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Ignore Discord failures — don't crash the app
  }
}

export async function sendGameSummary(
  roomId: string,
  gameMode: string,
  state: ServerGameState,
  startedAt: number,
): Promise<void> {
  if (!GAME_WEBHOOK_URL) return

  const players = state.players
  const durationMs = Date.now() - startedAt
  const durationMin = Math.floor(durationMs / 60000)
  const durationSec = Math.floor((durationMs % 60000) / 1000)
  const durationStr = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`

  const medals = ['🥇', '🥈', '🥉']
  const rankingLines: string[] = []

  for (const id of state.finishedPlayerIds) {
    if (id === state.loser) continue
    const p = players.find((p) => p.id === id)
    if (p) {
      const medal = medals[rankingLines.length] ?? `#${rankingLines.length + 1}`
      rankingLines.push(`${medal} ${p.name}`)
    }
  }

  const loserPlayer = state.loser ? players.find((p) => p.id === state.loser) : null
  if (loserPlayer) rankingLines.push(`💩 ${loserPlayer.name}`)

  await postWebhook(GAME_WEBHOOK_URL, {
    embeds: [{
      title: `Game Over — Room ${roomId}`,
      description: rankingLines.join('\n') || 'No ranking available',
      color: 0x4cc9f0,
      fields: [
        { name: 'Mode', value: gameMode === 'double_deck' ? 'Double Deck' : 'Normal', inline: true },
        { name: 'Players', value: String(players.length), inline: true },
        { name: 'Duration', value: durationStr, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  })
}

function formatMessage(record: LogRecord): string {
  return record.message.map((part) => typeof part === 'string' ? part : String(part)).join('')
}

export function discordAlertsSink(record: LogRecord): void {
  if (record.level !== 'warning' && record.level !== 'error' && record.level !== 'fatal') return
  if (!ALERTS_WEBHOOK_URL) return

  const levelColors: Record<string, number> = {
    warning: 0xffd60a,
    error: 0xff4444,
    fatal: 0x9b2226,
  }
  const levelEmoji: Record<string, string> = {
    warning: '⚠️',
    error: '🔴',
    fatal: '💥',
  }

  const color = levelColors[record.level] ?? 0xffd60a
  const emoji = levelEmoji[record.level] ?? '⚠️'
  const text = formatMessage(record)
  const category = record.category.join('.')

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: 'Level', value: `${emoji} ${record.level.toUpperCase()}`, inline: true },
    { name: 'Category', value: category, inline: true },
  ]

  const props = Object.entries(record.properties)
  if (props.length > 0) {
    const propsStr = props.map(([k, v]) => `**${k}**: ${String(v)}`).join('\n')
    fields.push({ name: 'Context', value: propsStr.slice(0, 1024), inline: false })
  }

  // Fire-and-forget — don't block the logger
  postWebhook(ALERTS_WEBHOOK_URL, {
    embeds: [{
      title: `${emoji} ${record.level.toUpperCase()}: ${text.slice(0, 256)}`,
      color,
      fields,
      timestamp: new Date(record.timestamp).toISOString(),
    }],
  })
}
