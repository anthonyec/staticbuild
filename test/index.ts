import fs, { cpSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"

import staticbuild, { StaticBuildOptions } from "../src/staticbuild"
import { isKeyValuePair, isStringLiteral, parseArgv } from "../src/args"
import { scan } from "../src/fs"
import { stdout } from "node:process"

const SHOW_INFO_LOGS = false

function expectFileExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw Error(`Expected "${filePath}" to exist but it does not`)
  }
}

function expectFilesEqual(actualFilePath: string, expectedFilePath: string) {
  expectFileExists(actualFilePath)
  expectFileExists(expectedFilePath)

  // @TODO: These are trimmed to avoid checking for newline differences at the
  // end of a file, but actually it might be nice to actually add a newline
  // when generating to be good computer citizens.
  const actualContents = fs.readFileSync(actualFilePath, "utf8").trim()
  const expectedContents = fs.readFileSync(expectedFilePath, "utf8").trim()

  let isDifferent: boolean = false

  let index: number = 0
  let line: number = 0

  while (index < Math.max(actualContents.length, expectedContents.length)) {
    const actualCharacter = actualContents[index]
    const expectedCharacter = expectedContents[index]

    if (!actualCharacter) {
      isDifferent = true
      break
    }

    if (!expectedCharacter) {
      isDifferent = true
      break
    }

    if (actualCharacter !== expectedCharacter) {
      isDifferent = true
      break
    }

    index += 1
  }

  if (isDifferent) {
    console.log(`\x1b[38;2;0;255;0mExpected:\n${expectedContents}\x1b[0m`)
    console.log(`\x1b[38;2;255;0;0mActual:\n${actualContents}\x1b[0m`)
    throw Error("Files are different")
  }
}

function expectDirectoriesEqual(actualDirectoryPath: string, expectedDirectoryPath: string) {
  for (const file of scan(actualDirectoryPath)) {
    if (file.isDirectory) continue

    const expectedFilePath = path.join(expectedDirectoryPath, path.relative(actualDirectoryPath, file.path))

    if (!fs.existsSync(expectedFilePath)) {
      throw Error(`Unexpected file: ${file.path}`)
    }
  }

  for (const file of scan(expectedDirectoryPath)) {
    if (file.isDirectory) continue

    const actualFilePath = path.join(actualDirectoryPath, path.relative(expectedDirectoryPath, file.path))

    if (!fs.existsSync(actualFilePath)) {
      throw Error(`Expected file: ${actualFilePath}`)
    }

    expectFilesEqual(actualFilePath, file.path)
  }
}

async function test() {
  const options = {
    spec: "",
    updateSnapshots: false,
  }

  for (const arg of parseArgv(process.argv)) {
    if (isStringLiteral(arg)) {
      throw Error(`Error: Unknown argument ${arg.value}.\n`)
    }

    if (isKeyValuePair(arg)) {
      switch (arg.key) {
        case "spec": {
          options.spec = arg.value
          continue
        }

        case "update":
        case "u": {
          options.updateSnapshots = true
          continue
        }

        default: {
          throw Error(`Error: Unknown argument ${arg.key}.\n`)
        }
      }
    }
  }

  const timings: Record<string, { startTime: number; endTime: number }> = {}

  const logger: StaticBuildOptions["logger"] = {
    info: (...messages: unknown[]) =>
      SHOW_INFO_LOGS ? stdout.write(`\x1b[38;2;100;100;100m[info] ${messages.join(", ")}\x1b[0m  \n`) : null,
    warn: (...messages: unknown[]) => stdout.write(`\x1b[38;2;100;100;100m[warn] ${messages.join(", ")}\x1b[0m  \n`),
    error: (...messages: unknown[]) => stdout.write(`\x1b[38;2;100;100;100m[erro] ${messages.join(", ")}\x1b[0m  \n`),
    time: (name: string) => {
      timings[name] = { startTime: performance.now(), endTime: -1 }
    },
    timeEnd: (name: string) => {
      timings[name] = { ...timings[name], endTime: performance.now() }
    },
  }

  for (const directory of scan("./test", [], { recursive: false })) {
    if (options.spec && options.spec !== directory.name) continue

    if (!directory.isDirectory) continue

    if (directory.name.startsWith("x_")) {
      stdout.write(`\x1b[38;2;100;100;100m[skip]\x1b[0m ${directory.name.replace(/^x_/, "")} \n`)
      continue
    }

    const inputDirectory = path.join(process.cwd(), directory.path, "input")
    const outputDirectory = path.join(process.cwd(), directory.path, "output")

    if (fs.existsSync(outputDirectory)) {
      fs.rmSync(outputDirectory, { recursive: true })
    }

    await staticbuild({ inputDirectory, outputDirectory, logger })

    try {
      const expectedDirectory = path.join(directory.path, "expected")

      if (options.updateSnapshots) {
        stdout.write(`\x1b[38;2;0;200;255m[snap]\x1b[0m ${directory.name} \n`)
        fs.rmSync(expectedDirectory, { recursive: true })
        cpSync(outputDirectory, expectedDirectory, { recursive: true })
      } else {
        expectDirectoriesEqual(outputDirectory, expectedDirectory)
        stdout.write(`\x1b[38;2;0;255;0m[pass]\x1b[0m ${directory.name} \n`)
      }
    } catch (err: unknown) {
      stdout.write(`\x1b[38;2;255;0;0m[fail]\x1b[0m ${directory.name} \n`)
      throw err
    }

    for (const [name, time] of Object.entries(timings)) {
      if (time.endTime === -1) continue

      stdout.write(`\x1b[38;2;100;100;100m[time] ${name}: ${(time.endTime - time.startTime).toFixed(1)}ms\x1b[0m \n`)
    }
  }
}

test()
