import * as fs from "fs"
import * as path from "path"

import { watcher } from "./watcher"
import { createReloader } from "./reloader"

interface StaticBuildOptions {
  /** Specify an input folder containing website source files */
  inputDirectory: string
  /** Specify an output folder for the website to be built to */
  outputDirectory: string
  /** Specify path of the website config file */
  configPath: string
  /** Watch files in the `outputDirectory and build when they change */
  watch?: boolean
}

export default async function staticbuild(options: StaticBuildOptions) {
  const reloader = createReloader()

  async function build(changedFilePaths: string[] = []) {
    console.log("HELLO", changedFilePaths)
  }

  await build()

  if (options.watch) {
    console.log("---")
    console.log("👀 watching for changes...")

    reloader.start()

    await watcher(options.inputDirectory, async (changedFilePaths) => {
      console.log("---")

      try {
        await build(changedFilePaths)
        reloader.reload()
      } catch (err) {
        console.log("error:", err)
      }
    })
  }
}
