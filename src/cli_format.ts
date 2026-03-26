import { assert } from "./assert"

export function colorize(text: string, color: [r: number, g: number, b: number]): string {
  assert(color.length === 3)

  const [r, g, b] = color
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`
}
