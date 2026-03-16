import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { HTMLElement, parse as parseHTML } from "node-html-parser"
import Mustache, { Context } from "mustache"
import * as markdown from "markdown-wasm"

import { assert } from "./assert"
import { scanDirectory } from "./fs"
import { watcher } from "./watcher"
import { createReloader, Reloader } from "./reloader"

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

  baseURL: string
}

type UserConfig = {
  redirects?: Record<string, string>
  copies?: string[]
}

type WillMutate<T> = T

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
  relativeInputPath: string
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
  attributes: { [name: string]: string }
}

type Templates = Map<string, string>

function isMemoryFile(value: unknown): value is MemoryOutputFile {
  return value != null && typeof value == "object" && "buffer" in value
}

function isExternalFile(value: unknown): value is ExternalOutputFile {
  return value != null && typeof value == "object" && "inputPath" in value
}

function hash(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex")
}

function requireUncached<T>(module: string): T {
  delete require.cache[require.resolve(module)]
  return require(module)
}

function resolveToAbsoluteInputPath(currentDirectory: string, value: unknown): string | undefined {
  if (!value) return
  if (typeof value !== "string") return
  if (!value.includes("/")) return
  if (value.startsWith("http")) return

  const inputPath = path.resolve(currentDirectory, value)
  if (!fs.existsSync(inputPath)) return
  if (fs.statSync(inputPath).isDirectory()) return

  return path.join("/", inputPath)
}

function resolveAttributesToAbsoluteInputPaths(currentDirectory: string, root: WillMutate<HTMLElement>) {
  for (const element of root.querySelectorAll("*")) {
    for (const [name, value] of Object.entries(element.attributes)) {
      const absoluteInputPath = resolveToAbsoluteInputPath(currentDirectory, value)
      if (!absoluteInputPath) continue

      element.setAttribute(name, absoluteInputPath)
    }
  }
}

function getTemplates(inputDirectory: string, directoryName: string): Templates {
  assert(directoryName.startsWith("_"))

  const templates: Templates = new Map()

  const templatesDirectory = path.join(inputDirectory, directoryName)
  if (!fs.existsSync(templatesDirectory)) return templates

  for (const file of scanDirectory(templatesDirectory)) {
    const fileContents = fs.readFileSync(file.path, "utf8")

    const document = parseHTML(fileContents)
    resolveAttributesToAbsoluteInputPaths(templatesDirectory, document)

    templates.set(file.name, document.toString())
  }

  return templates
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
    relativeInputPath: relativeFilePath,
    date: new Date(date),
    collection: collectionName,
    data: {},
  }
}

function absoluteInputPathToRelativeOutputPath(inputDirectory: string, absoluteInputPath: string): string {
  const relativeInputPath = path.relative(inputDirectory, absoluteInputPath)
  const collectionEntry = getCollectionEntryFromPath(relativeInputPath)

  if (collectionEntry) {
    const [, , ...rest] = relativeInputPath.split("/")
    return path.join("/", path.join(collectionEntry.path, ...rest))
  }

  return path.join("/", relativeInputPath)
}

function collectAssetsFromPageData(
  currentDirectory: string,
  inputDirectory: string,
  outputDirectory: string,
  files: WillMutate<OutputFiles>,
  dependencies: WillMutate<Dependencies>,
  pageData: PageData,
) {
  for (const value of Object.values(pageData)) {
    const absoluteInputPath = resolveToAbsoluteInputPath(currentDirectory, value)
    if (!absoluteInputPath) continue

    const relativeOutputPath = absoluteInputPathToRelativeOutputPath(inputDirectory, absoluteInputPath)

    dependencies.add(absoluteInputPath)

    const fileID = hash(absoluteInputPath)
    files.set(fileID, {
      inputPath: absoluteInputPath,
      outputPath: path.join(outputDirectory, relativeOutputPath),
    })
  }
}

function collectAssetsFromDocument(
  inputDirectory: string,
  outputDirectory: string,
  files: WillMutate<OutputFiles>,
  dependencies: WillMutate<Dependencies>,
  document: WillMutate<HTMLElement>,
) {
  // @TODO(SPEED): No need to go over paths again and check since when resolving
  // we could keep a list and reuse it here. IT will be a big speed improvement
  // if this is done! ~600ms to ~130ms!
  for (const element of document.querySelectorAll("*")) {
    for (const [name, value] of Object.entries(element.attributes)) {
      if (!value) continue
      if (!value.includes("/")) continue
      if (!value.startsWith(inputDirectory)) continue

      const absoluteInputPath = value

      if (!fs.existsSync(absoluteInputPath)) {
        console.error(`Could not find asset: ${absoluteInputPath}`)
        continue
      }

      if (fs.statSync(absoluteInputPath).isDirectory()) {
        console.error(`Skipping asset, it's a directory: ${absoluteInputPath}`)
        continue
      }

      if (path.extname(absoluteInputPath) && element.hasAttribute("sb:inline")) {
        const svg = fs.readFileSync(absoluteInputPath, "utf8")
        element.replaceWith(svg)
        continue
      }

      const relativeOutputPath = absoluteInputPathToRelativeOutputPath(inputDirectory, absoluteInputPath)
      element.setAttribute(name, path.join("/", relativeOutputPath))
      dependencies.add(absoluteInputPath)

      const fileID = hash(absoluteInputPath)
      files.set(fileID, {
        inputPath: absoluteInputPath,
        outputPath: path.join(outputDirectory, relativeOutputPath),
      })
    }
  }
}

function collectInlineCodeFromDocument(
  outputDirectory: string,
  files: WillMutate<OutputFiles>,
  document: WillMutate<HTMLElement>,
) {
  const styles: Set<string> = new Set()
  const scripts: Set<string> = new Set()

  for (const element of document.querySelectorAll("style, script:not([src])")) {
    if (element.hasAttribute("sb:buildtime")) continue

    const textContent = element.textContent
    element.remove()

    switch (element.tagName) {
      case "STYLE": {
        styles.add(textContent)
        break
      }

      case "SCRIPT": {
        scripts.add(textContent)
        break
      }
    }
  }

  let styleContents = ""
  let scriptContents = ""

  for (const style of styles) {
    styleContents += style + "\n"
  }

  for (const script of scripts) {
    scriptContents += `(function() {${script}})()` + "\n"
  }

  if (styleContents.trim()) {
    const fileID = hash(styleContents)
    const relativeOutputPath = path.join("/", "assets", "css", fileID + ".css")

    files.set(fileID, {
      buffer: Buffer.from(styleContents),
      outputPath: path.join(outputDirectory, relativeOutputPath),
    })

    document.append(`<link rel="stylesheet" href="${relativeOutputPath}"/ >`)
  }

  if (scriptContents.trim()) {
    const fileID = hash(scriptContents)
    const relativeOutputPath = path.join("/", "assets", "js", fileID + ".js")

    files.set(fileID, {
      buffer: Buffer.from(scriptContents),
      outputPath: path.join(outputDirectory, relativeOutputPath),
    })

    document.append(`<script src="${relativeOutputPath}" async defer></script>`)
  }
}

function absoluteToRelativePath(inputDirectory: string, absolutePath: string): string {
  return absolutePath.replace(path.join(inputDirectory, "/"), "")
}

function collectCollectionDependencies(
  inputDirectory: string,
  template: string,
  collectionNameToEntries: CollectionEntries,
  dependencies: WillMutate<Set<string>>,
) {
  for (const spans of Mustache.parse(template)) {
    const [command, argument] = spans
    if (command !== "#") continue
    if (!argument.startsWith("collection.")) continue

    const [, collectionName] = argument.split(".")

    for (const entry of collectionNameToEntries[collectionName]) {
      dependencies.add(path.join(inputDirectory, entry.relativeInputPath))
    }
  }
}

function renderHTMLPage(
  reloader: Reloader,
  options: StaticBuildOptions,
  absoluteFilePath: string,
  fileContents: string,
  collectionNameToEntries: WillMutate<CollectionEntries>,
  inputDependencies: WillMutate<InputDependencies>,
  outputFiles: WillMutate<OutputFiles>,
  layouts: Templates,
): [renderedPage: string, page: Context["page"]] {
  const currentDirectory = path.dirname(absoluteFilePath)

  const dependencies: Set<string> = new Set()

  const context: Context = {
    site: {
      url: options.baseURL,
    },
    page: {
      title: "",
      date: null,
      content: "",
      data: {},
    },
    collection: collectionNameToEntries,
    fn: TEMPLATE_FUNCTIONS,
    attributes: {},
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

  const relativeInputDirectory = path.relative(options.inputDirectory, currentDirectory)
  const collectionEntry = getCollectionEntryFromPath(relativeInputDirectory)

  if (collectionEntry) {
    context.page.date = collectionEntry?.date
  }

  const layout = collectionEntry && layouts && layouts.get(collectionEntry.collection)
  const template = layout ?? preTemplateDocument.toString()

  // Render template.
  const html = Mustache.render(template, context)
  collectCollectionDependencies(options.inputDirectory, template, collectionNameToEntries, dependencies)

  // Parse the HTML ready for modification.
  let document = parseHTML(html)

  // Before assets are collected or modified, change all the source paths from
  // relative to absolute. This makes it easier to deal with for both developer
  // and processing.
  resolveAttributesToAbsoluteInputPaths(currentDirectory, document)

  const includeStack = Array.from(document.querySelectorAll("sb\\:include"))

  while (includeStack.length) {
    const element = includeStack.pop()
    if (!element) break

    const src = element.getAttribute("src")

    if (!src) {
      element.remove()
      continue
    }

    if (!fs.existsSync(src)) {
      console.error(`Could not find include: ${src}`)
      element.remove()
      continue
    }

    const includeContents = fs.readFileSync(src, "utf8")

    const includeDocument = parseHTML(includeContents)
    resolveAttributesToAbsoluteInputPaths(path.dirname(src), includeDocument)

    const includeHtml = Mustache.render(includeDocument.toString(), {
      ...context,
      attributes: {
        ...element.attributes,
        children: element.innerHTML,
      },
    })

    includeStack.push(...Array.from(includeDocument.querySelectorAll("sb\\:include")))

    element.replaceWith(includeHtml)
    dependencies.add(src)
  }

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

  // Collect the assets and if needed, modify the page if needed to reflect the
  // final output asset paths.
  collectAssetsFromPageData(
    currentDirectory,
    options.inputDirectory,
    options.outputDirectory,
    outputFiles,
    dependencies,
    context.page.data,
  )
  collectAssetsFromDocument(options.inputDirectory, options.outputDirectory, outputFiles, dependencies, document)
  collectInlineCodeFromDocument(options.outputDirectory, outputFiles, document)

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
  const reloader = createReloader()

  const inputDependencies: InputDependencies = new Map()
  const collectionNameToEntries: CollectionEntries = {}

  // @NOCHECKIN
  options.ignoredPaths = ["./v/", "./_layouts", "./_partials", "./assets"]

  const build = async (changedFilePaths: string[] = []) => {
    const outputFiles: OutputFiles = new Map()

    console.time("Built")

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

      for (const [parent, dependencies] of inputDependencies) {
        if (dependencies.has(absoluteFilePath)) {
          filePathProcessStack.push(parent)
        }
      }

      if (fs.statSync(absoluteFilePath).isDirectory()) continue

      const relativeFilePath = absoluteToRelativePath(options.inputDirectory, absoluteFilePath)
      if (shouldSkipFilePath(relativeFilePath, options.ignoredPaths)) continue

      switch (path.extname(absoluteFilePath)) {
        case ".js": {
          const fileBasename = path.basename(absoluteFilePath)

          if (fileBasename === "_config.js") {
            const userConfig = (requireUncached<UserConfig>(absoluteFilePath) ?? {}) as UserConfig

            for (const [from, to] of Object.entries(userConfig.redirects || {})) {
              const fileContents = `<link href="${to}" rel="canonical"><meta http-equiv="refresh" content="0;url=${to}"/>This page has moved. <a href="${to}">Click here if not redirected automatically.</a>`
              const outputPath = path.join(options.outputDirectory, from + ".html")
              const fileID = hash(outputPath)

              outputFiles.set(fileID, {
                buffer: Buffer.from(fileContents),
                outputPath,
              })
            }

            for (const relativeInputPath of userConfig.copies || []) {
              const absoluteInputPath = path.join(options.inputDirectory, relativeInputPath)

              if (fs.statSync(absoluteInputPath).isDirectory()) {
                for (const file of scanDirectory(absoluteInputPath)) {
                  if (file.isDirectory) continue

                  outputFiles.set(file.path, {
                    inputPath: file.path,
                    outputPath: path.join(options.outputDirectory, path.relative(options.inputDirectory, file.path)),
                  })
                }
              } else {
                outputFiles.set(fileID, {
                  inputPath: path.join(options.inputDirectory, relativeInputPath),
                  outputPath: path.join(options.outputDirectory, relativeInputPath),
                })
              }
            }

            break
          }
        }

        case ".md": {
          const fileBasename = path.basename(absoluteFilePath)
          if (fileBasename !== "index.md") continue

          const collectionEntry = getCollectionEntryFromPath(relativeFilePath)
          if (!collectionEntry) continue

          const layouts = getTemplates(options.inputDirectory, "_layouts")

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
            layouts,
          )

          const existingEntries = collectionNameToEntries[collectionEntry.collection] || []
          collectionNameToEntries[collectionEntry.collection] = existingEntries

          collectionEntry.title = page.title
          collectionEntry.data = page.data

          const existingEntryIndex = existingEntries.findIndex((entry) => entry.path === collectionEntry.path)

          if (existingEntryIndex !== -1) {
            existingEntries[existingEntryIndex] = collectionEntry
          } else {
            existingEntries.push(collectionEntry)
          }

          outputFiles.set(fileID, {
            buffer: Buffer.from(renderedPage),
            outputPath: path.join(options.outputDirectory, collectionEntry.path, "index.html"),
          })
          break
        }

        case ".html": {
          const layouts = getTemplates(options.inputDirectory, "_layouts")

          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const [renderedPage] = renderHTMLPage(
            reloader,
            options,
            absoluteFilePath,
            fileContents,
            collectionNameToEntries,
            inputDependencies,
            outputFiles,
            layouts,
          )

          outputFiles.set(fileID, {
            buffer: Buffer.from(renderedPage),
            outputPath: path.join(options.outputDirectory, relativeFilePath),
          })
          break
        }

        case ".txt":
        case ".xml": {
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const context: Context = {
            site: {
              url: options.baseURL,
            },
            page: {
              title: "",
              date: null,
              content: "",
              data: {},
            },
            collection: collectionNameToEntries,
            fn: TEMPLATE_FUNCTIONS,
            attributes: {},
          }

          const html = Mustache.render(fileContents, context)

          const dependencies: Set<string> = new Set()
          collectCollectionDependencies(options.inputDirectory, fileContents, collectionNameToEntries, dependencies)
          inputDependencies.set(absoluteFilePath, dependencies)

          outputFiles.set(fileID, {
            buffer: Buffer.from(html),
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

    console.log(`Count: ${outputFiles.size} file(s)`)
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
