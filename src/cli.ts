#! /usr/bin/env node
import * as fs from "fs"
import * as path from "path"
import { stdout } from "process"

import { staticbuild } from "."

interface Args {
  watch?: boolean
  dryRun?: boolean
  port?: string
  check?: boolean
}

const ERROR_CODE = {
  SUCCESS: 0,
  CALLED_WITH_ILLEGAL_PARAMETERS: 1,
  FAILED_T0_READ_LOCAL_FILE: 11,
}

const DEFAULT_ARGS: Required<Args> = {
  watch: false,
  dryRun: false,
  port: "8082",
  check: false,
}

function logUsage() {
  stdout.write(`Usage: staticbuild <inputDirectory> <outputDirectory> [--watch, --dry-run, --port, --check]\n`)

  stdout.write(`\nArguments:\n`)
  stdout.write(`<inputDirectory>    Path to directory containing content.\n`)
  stdout.write(`<outputDirectory>   Path to directory for built site assets.\n`)
  stdout.write(`--watch, -w         Watch the input directory and rebuild if there are changes.\n`)
  stdout.write(`--dry-run           Prevent writing files to disk, instead logging the file list out.\n`)
  stdout.write(`--port, -p          The expected port the site will be served from.\n`)
  stdout.write(`--check, -c         Perform a dead link check on the output files.\n`)
}

async function main() {
  // Remove the first 2 arguments that nodejs provides.
  const args = process.argv.splice(2, process.argv.length)

  if (args.length === 0) {
    logUsage()
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
  }

  const inputDirectory = args[0]
  const outputDirectory = args[1]

  // Parse options that user has provided as an args object.
  const options = args.reduce(
    (mem, arg) => {
      if (arg === "--watch" || arg === "-w") {
        mem["watch"] = true
      }

      if (arg === "--dry-run") {
        mem["dryRun"] = true
      }

      if (arg === "--check" || arg === "-c") {
        mem["check"] = true
      }

      if (arg.startsWith("--port") || arg.startsWith("-p")) {
        const splitValue = arg.split("=")

        if (splitValue.length === 2) {
          mem["port"] = splitValue[1].trim()
        }
      }

      return mem
    },
    { ...DEFAULT_ARGS },
  )
  // Check that the first argument is a path and not a command.
  if (!inputDirectory) {
    stdout.write(`Error: Missing input directory.\n`)
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
  }

  if (inputDirectory.slice(0, 1) === "-") {
    stdout.write(`Error: Invalid input directory.\n> ${inputDirectory}`)
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
  }

  // Check that the second argument is a path and not a command.
  if (!outputDirectory) {
    stdout.write(`Error: Missing output directory.\n`)
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
  }

  if (outputDirectory.slice(0, 1) === "-") {
    stdout.write(`Error: Invalid output directory.\n> ${inputDirectory}`)
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS
  }

  if (!fs.existsSync(inputDirectory)) {
    stdout.write(`Error: Input directory "${inputDirectory}" does not exist.\n`)
    return ERROR_CODE.FAILED_T0_READ_LOCAL_FILE
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory)
  }

  const baseURL =
    (process.env.context === "production" ? process.env.URL : process.env.DEPLOY_PRIME_URL) ||
    `http://localhost:${options?.port || DEFAULT_ARGS.port}`

  await staticbuild({
    inputDirectory: path.join(process.cwd(), inputDirectory),
    outputDirectory: path.join(process.cwd(), outputDirectory),
    configPath: path.join(process.cwd(), ".staticbuild"),
    baseURL,
    ...options,
  })
}

main()
