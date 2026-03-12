import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { HTMLElement, parse as parseHTML } from "node-html-parser"
import Mustache, { parse } from "mustache"
import * as markdown from "markdown-wasm"

import { assert } from "./assert"
import { scanDirectory } from "./fs"
import { watcher } from "./watcher"
import { createReloader, Reloader } from "./reloader"

const ASSETS_SELECTOR = "img, video, a, link[href], script[src]"

const TEMPLATE_FUNCTIONS: Context["fn"] = {
  dateToISO8601: () => (text, subRender) => {
    function formatDateWithTemplate(template: string, date: Date) {
      var specs = "YYYY:MM:DD:HH:mm:ss".split(":")
      date = new Date(date || Date.now() - new Date().getTimezoneOffset() * 6e4)

      return date
        .toISOString()
        .split(/[-:.TZ]/)
        .reduce(function (template, item, index) {
          return template.split(specs[index]).join(item)
        }, template)
    }

    const renderedDate = subRender(text)
    const date = new Date(renderedDate)
    return formatDateWithTemplate("YYYY-MM-DD", date)
  },

  dateToUTC: () => (text, render) => {
    const renderedDate = render(text)
    const date = new Date(renderedDate)
    return date.toUTCString()
  },

  removeH1: () => (text, render) => {
    const renderedText = render(text)
    return renderedText.replace(/<h1>.*(?:<a.*>.*<\/a>).*<\/h1>/g, "")
  },
}

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

type PageData = { [key: string]: string }

type CollectionName = string

type CollectionEntry = {
  title: string
  path: string
  date: Date
  collection: CollectionName
  data: PageData
}

// Plain JS object is used instead of a `Map` so that it can be passed to a
// template without having to serialize it.
type CollectionEntries = { [name: CollectionName]: CollectionEntry[] }

type MustacheFunction = () => (text: string, subRender: (template: string) => string) => string

type Context = {
  site: {
    url: string
  }
  page: {
    title: string
    content: string
    date: Date | null
    data: PageData
  }
  collection: CollectionEntries
  fn: { [name: string]: MustacheFunction }
}

function isMemoryFile(value: unknown): value is MemoryOutputFile {
  return value != null && typeof value == "object" && "buffer" in value
}

function isExternalFile(value: unknown): value is ExternalOutputFile {
  return value != null && typeof value == "object" && "inputPath" in value
}

function hash(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex")
}

function resolveAllPathsToAbsolute(currentDirectory: string, document: HTMLElement) {
  for (const element of document.querySelectorAll(ASSETS_SELECTOR)) {
    const attribute = getAssetAttribute(element)
    if (!attribute) continue
    if (attribute.value.startsWith("http")) continue

    const inputPath = path.resolve(currentDirectory, attribute.value)
    if (!fs.existsSync(inputPath)) continue
    if (fs.statSync(inputPath).isDirectory()) continue

    element.setAttribute(attribute.name, path.join("/", inputPath))
  }
}

type Templates = Map<string, string>

function getTemplates(inputDirectory: string, directoryName: string): Templates {
  assert(directoryName.startsWith("_"))

  const partials: Templates = new Map()

  const templatesDirectory = path.join(inputDirectory, directoryName)
  if (!fs.existsSync(templatesDirectory)) return partials

  for (const file of scanDirectory(templatesDirectory)) {
    const fileContents = fs.readFileSync(file.path, "utf8")

    const document = parseHTML(fileContents)
    resolveAllPathsToAbsolute(templatesDirectory, document)

    partials.set(file.name, document.toString())
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
    title: slug,
    path: path.join(collectionName, slug),
    date: new Date(date),
    collection: collectionName,
    data: {},
  }
}

function getAssetAttribute(element: HTMLElement): { name: string; value: string } | undefined {
  // @TODO: Only supports one asset attribute per element.
  for (const name of ["src", "sb:src", "href"]) {
    const value = element.getAttribute(name)

    if (value) {
      return { name, value }
    }
  }
}

function collectAssets(
  inputDirectory: string,
  outputDirectory: string,
  document: HTMLElement,
  files: OutputFiles,
  dependencies: Dependencies,
) {
  for (const element of document.querySelectorAll(ASSETS_SELECTOR)) {
    const attribute = getAssetAttribute(element)
    if (!attribute) continue

    const inputPath = attribute.value
    if (!inputPath) continue
    if (!inputPath.startsWith(inputDirectory)) continue

    if (!fs.existsSync(inputPath)) {
      console.error(`Could not find asset: ${inputPath}`)
      continue
    }

    if (fs.statSync(inputPath).isDirectory()) {
      console.error(`Skipping asset, it's a directory: ${inputPath}`)
      continue
    }

    if (path.extname(inputPath) && element.hasAttribute("sb:inline")) {
      const svg = fs.readFileSync(inputPath, "utf8")
      element.replaceWith(svg)
    }

    const fileID = hash(inputPath)

    dependencies.add(inputPath)

    const relativeInputDirectory = path.relative(inputDirectory, inputPath)
    const collectionEntry = getCollectionEntryFromPath(relativeInputDirectory)

    if (collectionEntry) {
      const [, , ...rest] = relativeInputDirectory.split("/")

      const relativeOutputPath = path.join(collectionEntry.path, ...rest)
      element.setAttribute(attribute.name, path.join("/", relativeOutputPath))

      files.set(fileID, {
        inputPath,
        outputPath: path.join(outputDirectory, relativeOutputPath),
      })
      continue
    }

    element.setAttribute(attribute.name, path.join("/", relativeInputDirectory))

    files.set(fileID, {
      inputPath,
      outputPath: path.join(outputDirectory, relativeInputDirectory),
    })
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
  layouts: Templates,
): [renderedPage: string, page: Context["page"]] {
  const context: Context = {
    site: {
      url: "", // @TODO: Implement.
    },
    page: {
      title: "",
      date: null,
      content: "",
      data: {},
    },
    collection: collectionNameToEntries,
    fn: TEMPLATE_FUNCTIONS,
  }

  const preTemplateDocument = parseHTML(fileContents)

  // Find the page title.
  const titleElement = preTemplateDocument.querySelector("title")
  const headingElement = preTemplateDocument.querySelector("h1:not([sb\\:ignore])")

  if (titleElement) {
    context.page.title = titleElement.textContent
  } else if (headingElement) {
    context.page.title = headingElement.textContent
  }

  // Parse script tags containing page data.
  for (const element of preTemplateDocument.querySelectorAll("data[sb\\:buildtime]")) {
    try {
      context.page.data = JSON.parse(element.textContent.trim())
    } catch (err: unknown) {
      console.error("Error parsing buildtime data\n> " + err)
    }

    element.remove()
  }

  // Setup page template if one exists.
  context.page.content = preTemplateDocument.toString()

  const currentDirectory = path.dirname(absoluteFilePath)
  const relativeInputDirectory = path.relative(options.inputDirectory, currentDirectory)
  const collectionEntry = getCollectionEntryFromPath(relativeInputDirectory)

  if (collectionEntry) {
    context.page.date = collectionEntry?.date
  }

  const layout = collectionEntry && layouts && layouts.get(collectionEntry.collection)
  const template = layout ?? preTemplateDocument.toString()

  // Parse and render template.
  const html = Mustache.render(template, context, Object.fromEntries(partials))

  // Parse the HTML ready for modification.
  let document = parseHTML(html)

  // Before assets are collected or modified, change all the source paths from
  // relative to absolute. This makes it easier to deal with for both developer
  // and processing.
  resolveAllPathsToAbsolute(currentDirectory, document)

  // Execute buildtime script tags.
  for (const element of document.querySelectorAll("script[sb\\:buildtime]")) {
    if (element.getAttribute("type") && element.getAttribute("type") != "text/javascript") continue

    try {
      eval(element.textContent)
    } catch (err: unknown) {
      console.error("Error executing buildtime script\n> " + err)
    }

    element.remove()
  }

  for (const element of document.querySelectorAll("[sb\\:selector]")) {
    const selector = element.getAttribute("sb:selector")
    if (!selector) continue
    if ((selector.includes(":hover"), selector.includes(":focus"))) continue

    if (!document.querySelector(selector)) {
      element.remove()
    } else {
      element.removeAttribute("sb:selector")
    }
  }

  // Modify the page assets.
  const dependencies: Set<string> = new Set()
  collectAssets(options.inputDirectory, options.outputDirectory, document, outputFiles, dependencies)
  collectInlineCode(options.outputDirectory, document, outputFiles)

  // Tidy the document.
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

  return [document.toString(), context.page]
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

          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const html = markdown.parse(fileContents)
          const [renderedPage, page] = renderHTMLPage(
            reloader,
            options,
            absoluteFilePath,
            html,
            collectionNameToEntries,
            inputDependencies,
            outputFiles,
            partials,
            layouts,
          )

          const existingEntries = collectionNameToEntries[collectionEntry.collection] || []
          if (existingEntries.find((entry) => entry.path === collectionEntry.path)) continue

          collectionEntry.title = page.title
          collectionEntry.data = page.data

          existingEntries.push(collectionEntry)
          collectionNameToEntries[collectionEntry.collection] = existingEntries

          // Turn modified HTML back into a file.
          outputFiles.set(fileID, {
            buffer: Buffer.from(renderedPage),
            outputPath: path.join(options.outputDirectory, collectionEntry.path, "index.html"),
          })

          break
        }

        case ".html": {
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const [renderedPage] = renderHTMLPage(
            reloader,
            options,
            absoluteFilePath,
            fileContents,
            collectionNameToEntries,
            inputDependencies,
            outputFiles,
            partials,
            layouts,
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
      console.log(" ")
    }

    for (const [_, file] of outputFiles) {
      const buffer: Buffer<ArrayBuffer> = isExternalFile(file)
        ? Buffer.from(fs.readFileSync(file.inputPath))
        : file.buffer

      if (options.dryRun) {
        console.log("[fake_file_write]")
        if (isExternalFile(file)) {
          console.log(" in: " + file.inputPath)
        } else {
          console.log(" in: " + `(buffer ${file.buffer.length} bytes)`)
        }

        console.log(" out: " + file.outputPath)

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
