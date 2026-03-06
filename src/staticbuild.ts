import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { HTMLElement, parse as parseHTML } from "node-html-parser"
import Mustache from "mustache"
import * as markdown from "markdown-wasm"

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

type FilePath = string
type FileID = string

type Dependencies = Set<FilePath>
type InputDependencies = Map<FilePath, Dependencies>

type MemoryOutputFile = {
  buffer: Buffer<ArrayBuffer>
}

type ExternalOutputFile = {
  inputPath: FilePath
}

type OutputFile = (MemoryOutputFile | ExternalOutputFile) & {
  outputPath: FilePath
}

type OutputFiles = Map<FileID, OutputFile>

function isMemoryFile(value: unknown): value is MemoryOutputFile {
  return value != null && typeof value == "object" && "buffer" in value
}

function isExternalFile(value: unknown): value is ExternalOutputFile {
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
  for (const ignoredPath of ignoredPaths || []) {
    const normalizedIgnoredPath = path.normalize(ignoredPath)

    if (relativeFilePath.startsWith(normalizedIgnoredPath)) {
      return true
    }
  }

  return false
}

type CollectionInfo = {
  name: string
  path: string
  date: Date
}

function getCollectionInfoFromPath(relativeFilePath: string): CollectionInfo | undefined {
  if (!relativeFilePath.startsWith("_")) return

  const parts = relativeFilePath.split("/")
  if (parts.length != 3) return

  const [rawName, rawDateAndSlug, filename] = parts

  const name = rawName.replace(/^_/, "")
  // Get the date part of the string, so that "2022-04-15-my-file" becomes "2022-04-15".
  const date = rawDateAndSlug.match(/^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)/g)?.[0] || ""
  const slug = rawDateAndSlug.replace(`${date}-`, "")

  return {
    name,
    path: path.join(name, slug, filename),
    date: new Date(date),
  }
}

function collectAssets(inputDirectory: string, outputDirectory: string, document: HTMLElement, files: OutputFiles, dependencies: Dependencies) {
  let styleContents = ""

  for (const element of document.querySelectorAll(`link[rel="stylesheet"]`)) {
    const href = element.getAttribute("href")
    if (!href) continue
    if (href.startsWith("http")) continue

    const inputPath = path.normalize(path.join(inputDirectory, href))
    if (!fs.existsSync(inputPath)) continue

    styleContents += fs.readFileSync(inputPath, "utf8")

    element.remove()
  }

  if (styleContents) {
    const fileID = hash(styleContents)
    const relativePath = path.join("/", "assets", "css", fileID + ".css")
    const outputPath = path.join(outputDirectory, relativePath)

    files.set(fileID, {
      buffer: Buffer.from(styleContents),
      outputPath,
    })

    document.append(`<link rel="stylesheet" href="${relativePath}" />`)
  }

  for (const element of document.querySelectorAll("img, video, a")) {
    const src = element.getAttribute("src") || element.getAttribute("href") || element.getAttribute("sb:src")
    if (!src) continue
    if (src.startsWith("http")) continue

    const inputPath = path.normalize(path.join(inputDirectory, src))
    if (!fs.existsSync(inputPath)) continue
    if (fs.statSync(inputPath).isDirectory()) continue

    const fileID = hash(inputPath)
    const outputPath = path.join(outputDirectory, src)

    if (path.extname(src) && element.hasAttribute("sb:inline")) {
      const svg = fs.readFileSync(inputPath, "utf8")
      element.replaceWith(svg)
    }

    files.set(fileID, {
      inputPath,
      outputPath,
    })

    dependencies.add(path.join(inputDirectory, src))
  }
}

function collectInlineCode(outputDirectory: string, document: HTMLElement, files: OutputFiles) {
  let scriptContent = ""
  let styleContent = ""

  for (const element of document.querySelectorAll("style, script:not([src])")) {
    if (element.hasAttribute("sb:buildtime")) continue

    const textContent = element.textContent

    element.remove()

    switch (element.tagName) {
      case "STYLE": {
        styleContent += textContent + "\n"
        break
      }

      case "SCRIPT": {
        scriptContent += textContent + "\n"
        break
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

    document.append(`<link rel="stylesheet" href="${relativePath}"/ >`)
  }

  if (scriptContent) {
    const fileID = hash(scriptContent)
    const relativePath = path.join("/", "assets", "js", fileID + ".js")

    files.set(fileID, {
      buffer: Buffer.from(scriptContent),
      outputPath: path.join(outputDirectory, relativePath),
    })

    document.append(`<script src="${relativePath}" async defer></script>`)
  }
}

export default async function staticbuild(options: StaticBuildOptions) {
  const inputDependencies: InputDependencies = new Map()
  const outputFiles: OutputFiles = new Map()
  const reloader = createReloader()

  // @NOCHECKIN
  options.ignoredPaths = ["./v/", "./_layouts", "./_partials", "./assets"]

  const build = async (changedFilePaths: string[] = []) => {
    console.time("Built")

    if (changedFilePaths.length == 0) {
      for await (const file of scanDirectory(options.inputDirectory)) {
        changedFilePaths.push(file.path)
      }
    }

    const filePathProcessQueue: string[] = [...changedFilePaths]

    while (filePathProcessQueue.length != 0) {
      const absoluteFilePath = filePathProcessQueue.pop()
      if (!absoluteFilePath) break

      const fileID = hash(absoluteFilePath)

      if (!fs.existsSync(absoluteFilePath)) {
        const existingFile = outputFiles.get(fileID)
        if (!existingFile) continue

        fs.unlinkSync(existingFile.outputPath)
        outputFiles.delete(fileID)
        continue
      }

      for (const [dependencyRoot, dependencies] of inputDependencies) {
        if (dependencies.has(absoluteFilePath)) {
            filePathProcessQueue.push(dependencyRoot)
        }
      }
      
      if (fs.statSync(absoluteFilePath).isDirectory()) continue
      
      const relativeFilePath = absoluteFilePath.replace(path.join(options.inputDirectory, "/"), "")
      if (shouldSkipFilePath(relativeFilePath, options.ignoredPaths)) continue

      const collectionInfo = getCollectionInfoFromPath(relativeFilePath)

      switch (path.extname(absoluteFilePath)) {
        case ".md": {
          // Render template tags.
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const html = markdown.parse(fileContents)

          // Parse HTML.
          const document = parseHTML(html)
          const dependencies: Set<string> = new Set()

          collectAssets(options.inputDirectory, options.outputDirectory, document, outputFiles, dependencies)
          collectInlineCode(options.outputDirectory, document, outputFiles)

          if (options.watch) {
            document.append(reloader.getScript())
          }

          outputFiles.set(fileID, {
            buffer: Buffer.from(document.toString()),
            outputPath: path.join(
              options.outputDirectory,
              collectionInfo ? collectionInfo.path.replace(".md", ".html") : relativeFilePath.replace(".md", ".html"),
            ),
          })
          break
        }

        case ".html": {
          // Render template tags.
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")

          const preTemplateDocument = parseHTML(fileContents)
          const context = {
            data: {},
          }

          for (const element of preTemplateDocument.querySelectorAll("[sb\\:buildtime]")) {
            if (element.getAttribute("type") != "application/json") continue

            try {
              const data = JSON.parse(element.textContent.trim())
              context.data = { ...context.data, ...data }
            } catch (err: unknown) {
              console.log("Error parsing buildtime data\n> " + err)
            }

            element.remove()
          }

          const html = Mustache.render(preTemplateDocument.toString(), context, getPartials(options))

          // Parse HTML.
          const document = parseHTML(html)
          const dependencies: Set<string> = new Set()

          collectAssets(options.inputDirectory, options.outputDirectory, document, outputFiles, dependencies)
          collectInlineCode(options.outputDirectory, document, outputFiles)

          for (const element of document.querySelectorAll("[sb\\:buildtime]")) {
            if (element.getAttribute("type") && element.getAttribute("type") != "text/javascript") continue

            try {
              eval(element.textContent)
            } catch(err: unknown) {
              console.log("Error executing buildtime script\n> " + err)
            }

            element.remove()
          }

          if (options.watch) {
            document.append(reloader.getScript())
          }

          outputFiles.set(fileID, {
            buffer: Buffer.from(document.toString()),
            outputPath: path.join(options.outputDirectory, collectionInfo ? collectionInfo.path : relativeFilePath),
          })

          inputDependencies.set(absoluteFilePath, dependencies)
          break
        }

        default:
          continue
      }
    }

    console.log(" ")

    console.timeEnd("Built")

    console.time("Write")

    for (const [_, file] of outputFiles) {
      const buffer: Buffer<ArrayBuffer> = isExternalFile(file)
        ? Buffer.from(fs.readFileSync(file.inputPath))
        : file.buffer

      fs.mkdirSync(path.dirname(file.outputPath), { recursive: true })
      fs.writeFileSync(file.outputPath, buffer)
    }

    console.timeEnd("Write")

    console.log(`Done (${new Date()})`)
  }

  await build()

  if (options.watch) {
    console.log("---")
    console.log("👀 Watching for changes...")

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
