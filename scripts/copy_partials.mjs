import fs from "node:fs"
import path from "node:path"

const INPUT_PARTIALS_DIRECTORY = path.join(process.cwd(), "src", "partials")
const OUTPUT_PARTIALS_DIRECTORY = path.join(process.cwd(), "dist", "partials")

if (!fs.existsSync(INPUT_PARTIALS_DIRECTORY)) {
  throw Error("Could not find partials directory")
}

fs.cpSync(INPUT_PARTIALS_DIRECTORY, OUTPUT_PARTIALS_DIRECTORY, { recursive: true })
