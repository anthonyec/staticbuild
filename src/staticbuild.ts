import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { HTMLElement, parse as parseHTML } from "node-html-parser"
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

type FileID = string

type MemoryFile = {
  buffer: Buffer<ArrayBuffer>
}

type ExternalFile = {
  inputPath: string
}

type File = (MemoryFile | ExternalFile) & {
  outputPath: string
}

type Files = Map<FileID, File>

type Page = {
  title: string
  assets: File[]
}

function isMemoryFile(value: unknown): value is MemoryFile {
  return value != null && typeof value == "object" && "buffer" in value
}

function isExternalFile(value: unknown): value is ExternalFile {
  return value != null && typeof value == "object" && "inputPath" in value
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

function shouldSkipFilePath(relativeFilePath: string, ignoredPaths: string[] = []): boolean {
  if (relativeFilePath.startsWith("_")) {
    return true
  }

  for (const ignoredPath of ignoredPaths || []) {
    const normalizedIgnoredPath = path.normalize(ignoredPath)

    if (relativeFilePath.startsWith(normalizedIgnoredPath)) {
      return true
    }
  }

  return false
}

function collectAssets(inputDirectory: string, outputDirectory: string, document: HTMLElement, files: Files) {
  let styleContents = ""

  for (const element of document.querySelectorAll(`link[rel="stylesheet"]`)) {
    const href = element.getAttribute("href")
    if (!href) continue
    if (href.startsWith("http")) continue

    const inputPath = path.normalize(path.join(inputDirectory, href))
    if (!fs.existsSync(inputPath)) continue

    styleContents += fs.readFileSync(inputPath, "utf8")

    element.parentNode.removeChild(element)
  }

  const headElement = document.querySelector("head")

  if (styleContents && headElement) {
    const fileID = hash(styleContents)
    const relativePath = path.join("/", "assets", "css", fileID + ".css")
    const outputPath = path.join(outputDirectory, relativePath)

    files.set(fileID, {
      buffer: Buffer.from(styleContents),
      outputPath,
    })

    headElement.append(`<link rel="stylesheet" href="${relativePath}"/ >`)
  }

  for (const element of document.querySelectorAll("img, video")) {
    const src = element.getAttribute("src") || element.getAttribute("sb:src")
    if (!src) continue
    if (src.startsWith("http")) continue

    const inputPath = path.normalize(path.join(inputDirectory, src))
    if (!fs.existsSync(inputPath)) continue

    const fileID = hash(inputPath)
    const outputPath = path.join(outputDirectory, src)

    switch (path.extname(src)) {
      case ".svg": {
        if (!element.hasAttribute("sb:inline")) break

        const svg = fs.readFileSync(inputPath, "utf8")
        element.replaceWith(svg)
      }
    }

    files.set(fileID, {
      inputPath: inputPath,
      outputPath,
    })
  }
}

function collectInlineCode(outputDirectory: string, document: HTMLElement, files: Files) {
  const headElement = document.querySelector("head")
  if (!headElement) return

  let scriptContent = ""
  let styleContent = ""

  for (const element of document.querySelectorAll("style, script:not([src])")) {
    const textContent = element.textContent

    element.parentNode.removeChild(element)

    switch (element.tagName) {
      case "STYLE": {
        styleContent += textContent + "\n"
      }

      case "SCRIPT": {
        scriptContent += textContent + "\n"
      }
    }
  }

  if (styleContent) {
    const fileID = hash(styleContent)
    const relativePath = path.join("/", "assets", "css", fileID + ".css")

    files.set(fileID, {
      buffer: Buffer.from(styleContent),
      outputPath: path.join(outputDirectory, relativePath),
    })

    headElement.append(`<link rel="stylesheet" href="${relativePath}"/ >`)
  }

  if (scriptContent) {
    const fileID = hash(scriptContent)
    const relativePath = path.join("/", "assets", "js", fileID + ".js")

    files.set(fileID, {
      buffer: Buffer.from(scriptContent),
      outputPath: path.join(outputDirectory, relativePath),
    })

    headElement.append(`<script src="${relativePath}" async defer></script>`)
  }
}

export default async function staticbuild(options: StaticBuildOptions) {
  const files: Files = new Map()
  const reloader = createReloader()

  // @NOCHECKIN
  options.ignoredPaths = ["./v/", "./_layouts", "./_partials", "./assets"]

  const build = async (changedFilePaths: string[] = []) => {
    console.time("build")

    if (changedFilePaths.length == 0) {
      for await (const file of scanDirectory(options.inputDirectory)) {
        changedFilePaths.push(file.path)
      }
    }

    for (const absoluteFilePath of changedFilePaths) {
      const fileID = hash(absoluteFilePath)

      if (!fs.existsSync(absoluteFilePath)) {
        const existingFile = files.get(fileID)
        if (!existingFile) continue

        fs.unlinkSync(existingFile.outputPath)
        files.delete(fileID)
        continue
      }

      if (fs.statSync(absoluteFilePath).isDirectory()) continue

      const relativeFilePath = absoluteFilePath.replace(path.join(options.inputDirectory, "/"), "")
      if (shouldSkipFilePath(relativeFilePath, options.ignoredPaths)) continue

      const extension = path.extname(absoluteFilePath)
      const name = path.basename(absoluteFilePath, extension)

      switch (extension) {
        case ".html": {
          // Render template tags.
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const html = Mustache.render(fileContents, {}, getPartials(options))

          // Parse HTML.
          const document = parseHTML(html)

          collectAssets(options.inputDirectory, options.outputDirectory, document, files)
          collectInlineCode(options.outputDirectory, document, files)

          files.set(fileID, {
            buffer: Buffer.from(document.toString()),
            outputPath: path.join(options.outputDirectory, relativeFilePath),
          })
        }

        default:
          continue
      }
    }

    // console.log(files)

    for (const [_, file] of files) {
      const buffer: Buffer<ArrayBuffer> = isExternalFile(file)
        ? Buffer.from(fs.readFileSync(file.inputPath))
        : file.buffer

      fs.mkdirSync(path.dirname(file.outputPath), { recursive: true })
      fs.writeFileSync(file.outputPath, buffer)
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
