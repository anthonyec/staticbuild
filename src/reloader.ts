import * as http from "http"
import { EventEmitter } from "events"

const BASE_PORT = 4000

export interface Reloader {
  getPort: () => number
  reload: () => void
  start: () => Promise<unknown>
}

function event(name: string, message?: string) {
  return `event: ${name}\ndata: ${message}\n\n`
}

export function createReloader(): Reloader {
  let port = BASE_PORT
  const events = new EventEmitter()

  let ready: (value: unknown) => void | undefined
  let error: (reason: unknown) => void | undefined

  const waitForStart = new Promise((resolve, reject) => {
    ready = resolve
    error = reject
  })

  async function start() {
    const server = http.createServer(function (_request, response) {
      response.setHeader("Content-Type", "text/event-stream")
      response.setHeader("access-control-allow-origin", "*")

      events.once("reload", () => {
        response.write(event("reload"))
      })
    })

    server.once("error", (err) => {
      server.close()

      if (err instanceof Error && err.code === "EADDRINUSE") {
        if (port > BASE_PORT + 1000) {
          return error("Failed to find a port for the reloader")
        }

        port++
        start()
      }
    })

    server.once("listening", () => {
      ready(0)
    })

    server.listen(port)

    await waitForStart
  }

  return {
    getPort: () => port,
    reload: () => events.emit("reload"),
    start,
  }
}
