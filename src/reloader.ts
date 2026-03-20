import * as http from "http"
import { EventEmitter } from "events"

const BASE_PORT = 4000

export interface Reloader {
  getPort: () => number
  reload: () => void
  start: () => Promise<unknown>
}

type ErrorWithCode = Error & { code: string }

function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return error instanceof Error && "code" in error && typeof error.code === "string"
}

function event(name: string, message?: string) {
  return `event: ${name}\ndata: ${message}\n\n`
}

export function createReloader(): Reloader {
  let port = BASE_PORT
  const events = new EventEmitter()

  let ready: (value: unknown) => void | undefined
  let throwError: (reason: unknown) => void | undefined

  const waitForStart = new Promise((resolve, reject) => {
    ready = resolve
    throwError = reject
  })

  async function start() {
    const server = http.createServer(function (_request, response) {
      response.setHeader("Content-Type", "text/event-stream")
      response.setHeader("access-control-allow-origin", "*")

      for (const listener of events.listeners("reload")) {
        events.off("reload", listener)
      }

      events.once("reload", () => {
        response.write(event("reload"))
      })
    })

    server.once("error", (error) => {
      server.close()

      if (isErrorWithCode(error) && error.code === "EADDRINUSE") {
        if (port > BASE_PORT + 1000) {
          return throwError("Failed to find a port for the reloader")
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
