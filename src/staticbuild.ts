import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { parse as parseHTML } from "node-html-parser"
import Mustache from "mustache"

import { scanDirectory } from "./fs"
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

interface ExternalAsset {
  inputPath: string
}

interface InlineAsset {
  contents: string
}

type Asset = { type: "css" | "js" } & (ExternalAsset | InlineAsset)

type MemoryFile = {
  buffer: ArrayBuffer
}

type ExternalFile = {
  inputPath: string
}

type File = { type: "css" | "js" | "unknown", outputPath: string } & (MemoryFile | ExternalFile)

interface Page {
  title: string
  html: string
  inputPath: string
  assets: Asset[]
}

function isExternalAsset(asset: unknown): asset is ExternalAsset {
  return asset != null && typeof asset == "object" && "inputPath" in asset
}

function isInlineAsset(asset: unknown): asset is ExternalAsset {
  return asset != null && typeof asset == "object" && "contents" in asset
}

function hash(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex")
}

type Partials = { [name: string]: string }

function getPartials(options: StaticBuildOptions): Partials {
  const partials: Partials = {}

  for (const file of scanDirectory(path.join(options.inputDirectory, "_partials"))) {
    partials[file.name] = fs.readFileSync(file.path, "utf8")
  }

  return partials
}

export default async function staticbuild(options: StaticBuildOptions) {
  const reloader = createReloader()

  // @NOCHECKIN
  options.ignoredPaths = ["./v/", "./_layouts", "./_partials"]

  async function build(changedFilePaths: string[] = []) {
    console.time("build")

    if (changedFilePaths.length == 0) {
      for await (const file of scanDirectory(options.inputDirectory)) {
        changedFilePaths.push(file.path)
      }
    }

    const pages: Page[] = []

    changes: for (const absoluteFilePath of changedFilePaths) {
      const relativeFilePath = absoluteFilePath.replace(path.join(options.inputDirectory, "/"), "")

      if (relativeFilePath.startsWith("_")) {
        continue changes
      }

      for (const ignoredPath of options.ignoredPaths || []) {
        const normalizedIgnoredPath = path.normalize(ignoredPath)

        if (relativeFilePath.startsWith(normalizedIgnoredPath)) {
          continue changes
        }
      }

      const fileExtension = path.extname(absoluteFilePath)

      switch (fileExtension) {
        case ".html": {
          const page: Page = {
            title: "",
            html: "",
            inputPath: relativeFilePath,
            assets: [],
          }

          // Render template tags.
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          page.html = Mustache.render(fileContents, {}, getPartials(options))

          // Parse HTML.
          const root = parseHTML(page.html)

          // Collect CSS and JS assets.
          const externalStylesheets = root.querySelectorAll('link[rel="stylesheet"]')
          const externalScripts = root.querySelectorAll("script[src]")
          const inlineStylesheets = root.querySelectorAll("style")
          const inlineScripts = root.querySelectorAll("script:not([src])")

          for (const node of externalScripts) {
            const src = node.getAttribute("src")
            if (!src) continue
            if (src.startsWith("http")) continue

            page.assets.push({ type: "js", inputPath: path.join(options.inputDirectory, src) })
            node.parentNode.removeChild(node)
          }

          for (const node of externalStylesheets) {
            const href = node.getAttribute("href")
            if (!href) continue

            page.assets.push({ type: "css", inputPath: path.join(options.inputDirectory, href) })
            node.parentNode.removeChild(node)
          }

          for (const node of inlineStylesheets) {
            const textContent = node.textContent
            if (!textContent) continue

            page.assets.push({ type: "css", contents: textContent })
            node.parentNode.removeChild(node)
          }

          for (const node of inlineScripts) {
            const textContent = node.textContent
            if (!textContent) continue

            page.assets.push({ type: "js", contents: textContent })
            node.parentNode.removeChild(node)
          }

          // Add page.
          pages.push(page)
        }

        default:
          continue
      }
    }

    for (const page of pages) {
      let combinedCssFilename = ""
      let combinedCssContents = ""

      for (const asset of page.assets) {
        if (!isExternalAsset(asset)) continue

        if (asset.type == "css") {
          combinedCssFilename += path.basename(asset.inputPath)
          combinedCssContents += fs.readFileSync(asset.inputPath, "utf8")
        }
      }

      const cssFilename = hash(combinedCssFilename) + ".css"
      const cssOutputDirectory = path.join(options.outputDirectory, "./assets/css")
      fs.mkdirSync(cssOutputDirectory, { recursive: true })
      fs.writeFileSync(path.join(cssOutputDirectory, cssFilename), combinedCssContents)

      const root = parseHTML(page.html)
      let headElement = root.querySelector("head")

      if (!headElement) {
        headElement = parseHTML("<head></head>")
        root.prepend(headElement)
      }

      headElement.append(`<link rel="" href="/assets/css/${cssFilename}">`)
      page.html = root.toString()

      const outputPath: string = path.join(options.outputDirectory, page.inputPath)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, page.html)
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
