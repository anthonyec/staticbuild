import * as fs from "fs"
import * as path from "path"
import { parse } from 'node-html-parser';

import { scanDirectory } from './fs' 
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

  ignoredPaths?: string[]
}

export default async function staticbuild(options: StaticBuildOptions) {
  const reloader = createReloader()

  // @NOCHECKIN
  options.ignoredPaths = ["./v/"]

  async function build(changedFilePaths: string[] = []) {
    console.time("build")

    if (changedFilePaths.length == 0) {
      for await (const file of scanDirectory(options.inputDirectory)) {
        changedFilePaths.push(file.path)
      }
    }

    const pages: Page[] = []
    
    changes: for (const absoluteFilePath of changedFilePaths) {
      const relativeFilePath = absoluteFilePath.replace(options.inputDirectory, ".")

      for (const ignoredPath of options.ignoredPaths || []) {
        if (relativeFilePath.startsWith(ignoredPath)) continue changes
      }

      if (absoluteFilePath.endsWith(".html")) {
        const fileContents = fs.readFileSync(absoluteFilePath, "utf-8")

        const pageAssets: Asset[] = []
  
        const root = parse(fileContents)
        const externalStylesheets = root.querySelectorAll("link[rel=\"stylesheet\"]")
        const externalScripts = root.querySelectorAll("script[src]")
        const inlineStylesheets = root.querySelectorAll("style")
        const inlineScripts = root.querySelectorAll("script:not([src])")
        
        for (const node of externalScripts) {
          const src = node.getAttribute("src")
          if (!src) continue
          if (src.startsWith("http")) continue

          pageAssets.push({ type: "js", inputPath: path.join(options.inputDirectory, src) })
          node.parentNode.removeChild(node)
        }

        for (const node of externalStylesheets) {
          const href = node.getAttribute("href")
          if (!href) continue

          pageAssets.push({ type: "css", inputPath: path.join(options.inputDirectory, href) })
          node.parentNode.removeChild(node)
        }

        for (const node of inlineStylesheets) {
          const textContent = node.textContent
          if (!textContent) continue

          pageAssets.push({ type: "css", contents: textContent })
          node.parentNode.removeChild(node)
        }

        for (const node of inlineScripts) {
          const textContent = node.textContent
          if (!textContent) continue

          pageAssets.push({ type: "js", contents: textContent })
          node.parentNode.removeChild(node)
        }

        const page: Page = {
          html: root.toString(),
          assets: pageAssets,
        }

        pages.push(page)
      }
    }

    console.timeEnd("build")
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
