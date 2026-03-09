import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { HTMLElement, parse as parseHTML } from "node-html-parser"
import Mustache from "mustache"
import * as markdown from "markdown-wasm"

import { assert } from "./assert"
import { scanDirectory } from "./fs"
import { watcher } from "./watcher"
import { createReloader, Reloader } from "./reloader"

interface StaticBuildOptions {
  /** Specify an input folder containing website source files */
  inputDirectory: string
  /** Specify an output folder for the website to be built to */
  outputDirectory: string
  /** Specify path of the website config file */
  configPath: string
  /** Watch files in the `outputDirectory` and build when they change */
  watch?: boolean
  dryRun?: boolean
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

type CollectionName = string

type CollectionEntry = {
  collection: CollectionName
  path: string
  date: Date
  title: string
}

// Plain JS object is used instead of Map so that it can be passed to a template
// without having to convert the data structure.
type CollectionEntries = { [name: CollectionName]: CollectionEntry[] }

function isMemoryFile(value: unknown): value is MemoryOutputFile {
  return value != null && typeof value == "object" && "buffer" in value
}

function isExternalFile(value: unknown): value is ExternalOutputFile {
  return value != null && typeof value == "object" && "inputPath" in value
}

function hash(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex")
}

type Templates = { [name: string]: string }

function getTemplates(inputDirectory: string, directoryName: string): Templates {
  assert(directoryName.startsWith("_"))

  const partials: Templates = {}

  const templatesDirectory = path.join(inputDirectory, directoryName)
  if (!fs.existsSync(templatesDirectory)) return partials

  for (const file of scanDirectory(templatesDirectory)) {
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

function getCollectionEntryFromPath(relativeFilePath: string): CollectionEntry | undefined {
  if (!relativeFilePath.startsWith("_")) return

  const [rawName, rawDateAndSlug = ""] = relativeFilePath.split("/")

  const collectionName = rawName.replace(/^_/, "")
  // Get the date part of the string, so that "2022-04-15-my-file" becomes "2022-04-15".
  const date = rawDateAndSlug.match(/^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)/g)?.[0] || ""
  const slug = rawDateAndSlug.replace(`${date}-`, "")

  return {
    collection: collectionName,
    path: path.join(collectionName, slug),
    date: new Date(date),
    title: slug,
  }
}

function collectAssets(
  currentDirectory: string,
  inputDirectory: string,
  outputDirectory: string,
  document: HTMLElement,
  files: OutputFiles,
  dependencies: Dependencies,
) {
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

  for (const element of document.querySelectorAll("img, video, a[download]")) {
    const src = element.getAttribute("src") || element.getAttribute("href") || element.getAttribute("sb:src")
    if (!src) continue
    if (src.startsWith("http")) continue

    const inputPath = path.resolve(currentDirectory, src)

    if (!fs.existsSync(inputPath)) {
      console.log(`Could not find asset: ${inputPath}`)
      continue
    }

    if (fs.statSync(inputPath).isDirectory()) {
      console.log(`Skipping asset, it's a directory: ${inputPath}`)
      continue
    }

    const relativeInputDirectory = path.relative(inputDirectory, currentDirectory)
    const collectEntry = getCollectionEntryFromPath(relativeInputDirectory)
    const outputPath = path.join(outputDirectory, collectEntry?.path ?? "", src)

    if (path.extname(src) && element.hasAttribute("sb:inline")) {
      const svg = fs.readFileSync(inputPath, "utf8")
      element.replaceWith(svg)
    }

    const fileID = hash(inputPath)

    files.set(fileID, {
      inputPath,
      outputPath,
    })

    dependencies.add(inputPath)
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

function absoluteToRelativePath(inputDirectory: string, absolutePath: string): string {
  return absolutePath.replace(path.join(inputDirectory, "/"), "")
}

function renderHTMLPage(
  reloader: Reloader,
  options: StaticBuildOptions,
  absoluteFilePath: string,
  fileContents: string,
  collectionNameToEntries: CollectionEntries,
  inputDependencies: InputDependencies,
  outputFiles: OutputFiles,
  partials: Templates,
): string {
  const context = {
    page: {
      title: "Untitled",
    },
    collection: collectionNameToEntries,
  }

  const preTemplateDocument = parseHTML(fileContents)

  // Parse script tags containing data and add it to the `context`.
  for (const element of preTemplateDocument.querySelectorAll("[sb\\:buildtime]")) {
    if (element.getAttribute("type") != "application/json") continue

    try {
      const pageData = JSON.parse(element.textContent.trim())
      context.page = {
        ...context.page,
        ...pageData,
      }
    } catch (err: unknown) {
      console.log("Error parsing buildtime data\n> " + err)
    }

    element.remove()
  }

  // Parse and render template.
  const html = Mustache.render(preTemplateDocument.toString(), context, partials)

  // Parse HTML and modify it.
  let document = parseHTML(html)
  const dependencies: Set<string> = new Set()
  collectAssets(
    path.dirname(absoluteFilePath),
    options.inputDirectory,
    options.outputDirectory,
    document,
    outputFiles,
    dependencies,
  )
  collectInlineCode(options.outputDirectory, document, outputFiles)

  // Execute buildtime script tags.
  for (const element of document.querySelectorAll("[sb\\:buildtime]")) {
    if (element.getAttribute("type") && element.getAttribute("type") != "text/javascript") continue

    try {
      eval(element.textContent)
    } catch (err: unknown) {
      console.log("Error executing buildtime script\n> " + err)
    }

    element.remove()
  }

  // Reparse the document and
  let headElement = document.querySelector("head")

  if (headElement) {
    // Reparse the modified document and tidy up all the script and
    // style tags to the <head> element to avoid unstyled flash.
    document = parseHTML(document.toString())
    headElement = document.querySelector("head")
    assert(headElement)

    for (const element of document.querySelectorAll(`link[rel="stylesheet"], script[src]`)) {
      headElement.appendChild(element.clone())
      element.remove()
    }
  }

  if (options.watch) {
    document.append(reloader.getScript())
  }

  inputDependencies.set(absoluteFilePath, dependencies)
  return document.toString()
}

export default async function staticbuild(options: StaticBuildOptions) {
  const inputDependencies: InputDependencies = new Map()
  const outputFiles: OutputFiles = new Map()

  const collectionNameToEntries: CollectionEntries = {}

  const reloader = createReloader()

  // @NOCHECKIN
  options.ignoredPaths = ["./v/", "./_layouts", "./_partials", "./assets"]

  const build = async (changedFilePaths: string[] = []) => {
    console.time("Built")

    const layouts = getTemplates(options.inputDirectory, "_layouts")
    const partials = getTemplates(options.inputDirectory, "_partials")

    if (changedFilePaths.length == 0) {
      for await (const file of scanDirectory(options.inputDirectory)) {
        changedFilePaths.push(file.path)
      }
    }

    // Sorted by underscore first so that collections get parsed before other
    // standalone pages, so that full collections are iterable by the time a
    // standalone page gets processed.
    //
    // This does mean that collection pages won't be able to display complete
    // lists of any collection. For example, a blog post can't show all blog
    // posts as a footer. But a homepage can show all the blog posts.
    //
    // This tradeoff is fine for now since my sites don't need this feature. If
    // they did, then some sort of multi-pass over the files would be needed.
    changedFilePaths.sort((a, b) => {
      const relativePathA = absoluteToRelativePath(options.inputDirectory, a)
      const relativePathB = absoluteToRelativePath(options.inputDirectory, b)

      if (relativePathA.startsWith("_") && !relativePathB.startsWith("_")) {
        return 1
      }

      if (!relativePathA.startsWith("_") && relativePathB.startsWith("_")) {
        return -1
      }

      return 0
    })

    const filePathProcessStack: string[] = [...changedFilePaths]

    while (filePathProcessStack.length != 0) {
      const absoluteFilePath = filePathProcessStack.pop()
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
          filePathProcessStack.push(dependencyRoot)
        }
      }

      if (fs.statSync(absoluteFilePath).isDirectory()) continue

      const relativeFilePath = absoluteToRelativePath(options.inputDirectory, absoluteFilePath)
      if (shouldSkipFilePath(relativeFilePath, options.ignoredPaths)) continue

      const collectionEntry = getCollectionEntryFromPath(relativeFilePath)
      const fileExtension = path.extname(absoluteFilePath)

      switch (fileExtension) {
        case ".md": {
          if (!collectionEntry) continue

          const existingEntries = collectionNameToEntries[collectionEntry.collection] || []
          existingEntries.push(collectionEntry)

          collectionNameToEntries[collectionEntry.collection] = existingEntries

          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const html = markdown.parse(fileContents)
          const renderedPage = renderHTMLPage(
            reloader,
            options,
            absoluteFilePath,
            html,
            collectionNameToEntries,
            inputDependencies,
            outputFiles,
            partials,
          )

          // Turn modified HTML back into a file.
          outputFiles.set(fileID, {
            buffer: Buffer.from(renderedPage),
            outputPath: path.join(options.outputDirectory, collectionEntry.path, "index.html"),
          })

          // const h1 = document.querySelector("h1")

          // if (h1) {
          //   collectionEntry.title = h1.textContent
          // }

          break
        }

        case ".html": {
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const renderedPage = renderHTMLPage(
            reloader,
            options,
            absoluteFilePath,
            fileContents,
            collectionNameToEntries,
            inputDependencies,
            outputFiles,
            partials,
          )

          // Turn modified HTML back into a file.
          outputFiles.set(fileID, {
            buffer: Buffer.from(renderedPage),
            outputPath: path.join(options.outputDirectory, relativeFilePath),
          })

          break
        }

        default:
          continue
      }
    }

    console.log(" ")

    console.timeEnd("Built")

    console.time("Write")

    if (options.dryRun) {
      console.log("Files that *would* be written:")
    }

    for (const [_, file] of outputFiles) {
      const buffer: Buffer<ArrayBuffer> = isExternalFile(file)
        ? Buffer.from(fs.readFileSync(file.inputPath))
        : file.buffer

      if (options.dryRun) {
        if (isExternalFile(file)) {
          console.log("- " + file.inputPath + " -> " + file.outputPath)
        } else {
          console.log("- " + "(buffer) -> " + file.outputPath)
        }
        console.log(" ")
      } else {
        fs.mkdirSync(path.dirname(file.outputPath), { recursive: true })
        fs.writeFileSync(file.outputPath, buffer)
      }
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
