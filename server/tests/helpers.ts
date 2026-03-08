import { createApp } from '../src/app.ts'

export class WSClient {
  #ws: WebSocket
  #queue: unknown[] = []
  #waiters: Array<(v: unknown) => void> = []

  constructor(url: string) {
    this.#ws = new WebSocket(url)
    this.#ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string)
      const resolve = this.#waiters.shift()
      if (resolve) resolve(msg)
      else this.#queue.push(msg)
    }
  }

  waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.#ws.readyState === WebSocket.OPEN) return resolve()
      this.#ws.onopen = () => resolve()
      this.#ws.onerror = () => reject(new Error('WS open failed'))
    })
  }

  send(msg: unknown): void {
    this.#ws.send(JSON.stringify(msg))
  }

  next(timeoutMs = 1000): Promise<unknown> {
    if (this.#queue.length) return Promise.resolve(this.#queue.shift())
    return new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('WS message timeout')), timeoutMs)
      this.#waiters.push((v) => { clearTimeout(id); resolve(v) })
    })
  }

  close(): void {
    this.#ws.close()
  }
}

export async function withServer(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = Deno.serve({ port: 0, onListen() {} }, createApp().fetch)
  const { port } = server.addr as Deno.NetAddr
  try {
    await fn(`http://localhost:${port}`)
  } finally {
    await server.shutdown()
  }
}
