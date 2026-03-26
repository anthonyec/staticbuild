#! /usr/bin/env node
import * as fs from "fs"
import * as path from "path"
import { stdout } from "process"

import type { StaticBuildOptions } from "./staticbuild"

import { staticbuild } from "."
import { isKeyValuePair, isStringLiteral, parseArgv } from "./cli_args"

const ERROR_CODE = {
  SUCCESS: 0,
  CALLED_WITH_ILLEGAL_PARAMETERS: 1,
  FAILED_T0_READ_LOCAL_FILE: 11,
}

function logUsage() {
  stdout.write(`🙅🏻‍♀️ staticbuild - a static site generator that isn't for you!\n\n`)
  stdout.write(`Usage: staticbuild <inputDirectory> <outputDirectory> [--watch, --dry-run, --check]\n`)

  stdout.write(`\nArguments:\n`)
  stdout.write(`<inputDirectory>    Path to directory containing content\n`)
  stdout.write(`<outputDirectory>   Path to directory for built site assets\n`)
  stdout.write(`--watch, -w         Watch the input directory and rebuild if there are changes\n`)
  stdout.write(`--dry-run           Prevent writing files to disk, instead logging the file list out\n`)
  stdout.write(`--check, -c         Perform a dead link check on the output files\n`)
  stdout.write(`--verbose, -v       Output all info and warning logs\n`)
}

async function main() {
  const options: StaticBuildOptions = {
    inputDirectory: "",
    outputDirectory: "",
    baseURL:
      (process.env.context === "production" ? process.env.URL : process.env.DEPLOY_PRIME_URL) ||
      "http://localhost:8082",
    logger: {
      info: () => {},
      warn: () => {},
      error: console.error,
      time: console.time,
      timeEnd: console.timeEnd,
    },
  }

  const argv = parseArgv(process.argv)

  if (argv.length === 0) {
    return logUsage()
  }

  for (const arg of argv) {
    if (isStringLiteral(arg) && arg.position === 0) {
      options.inputDirectory = path.join(process.cwd(), arg.value)
    }

    if (isStringLiteral(arg) && arg.position === 1) {
      options.outputDirectory = path.join(process.cwd(), arg.value)
    }

    if (isStringLiteral(arg) && arg.position > 1) {
      stdout.write(`Error: Unknown argument ${arg.value}\n`)
      return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
    }

    if (isKeyValuePair(arg)) {
      switch (arg.key) {
        case "watch":
        case "w": {
          options.watch = true
          continue
        }

        case "dry-run": {
          options.dryRun = true
          continue
        }

        case "check":
        case "c": {
          options.check = true
          continue
        }

        case "verbose":
        case "v": {
          if (options.logger) {
            options.logger.info = console.log
            options.logger.warn = console.warn
          }

          continue
        }

        default: {
          stdout.write(`Error: Unknown argument ${arg.key}\n`)
          return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
        }
      }
    }
  }

  // Check that the first argument is a path and not a command.
  if (!options.inputDirectory) {
    stdout.write(`Error: Missing input directory\n`)
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
  }

  // Check that the second argument is a path and not a command.
  if (!options.outputDirectory) {
    stdout.write(`Error: Missing output directory\n`)
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
  }

  if (!fs.existsSync(options.inputDirectory)) {
    stdout.write(`Error: Input directory "${options.inputDirectory}" does not exist\n`)
    return ERROR_CODE.FAILED_T0_READ_LOCAL_FILE
  }

  if (!fs.existsSync(options.outputDirectory)) {
    fs.mkdirSync(options.outputDirectory)
  }

  await staticbuild(options)
}

main()
