import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { HTMLElement, parse as parseHTML } from "node-html-parser"
import Mustache, { Context } from "mustache"
import * as markdown from "markdown-wasm"

import { assert, assertNever } from "./assert"
import { requireUncached, scan } from "./fs"
import { watcher } from "./watcher"
import { createReloader, Reloader } from "./reloader"

const TEMPLATE_FUNCTIONS: Context["fn"] = {
  dateToISO8601: () => (text, subRender) => {
    function formatDateWithTemplate(template: string, date: Date) {
      const specs = "YYYY:MM:DD:HH:mm:ss".split(":")

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

  dateToYear: () => (text, render) => {
    const renderedDate = render(text)
    const date = new Date(renderedDate)
    return date.getFullYear().toString()
  },

  removeH1: () => (text, render) => {
    const renderedText = render(text)
    return renderedText.replace(/<h1>.*(?:<a.*>.*<\/a>).*<\/h1>/g, "")
  },
}

export interface StaticBuildOptions {
  /** Specify an input folder containing website source files */
  inputDirectory: string
  /** Specify an output folder for the website to be built to */
  outputDirectory: string
  /** Watch files in the `outputDirectory` and build when they change */
  watch?: boolean
  dryRun?: boolean
  check?: boolean
  ignoredPaths?: string[]
  pathRemaps?: PathRemaps
  baseURL?: string

  logger?: {
    info: (...message: unknown[]) => void
    warn: (...message: unknown[]) => void
    error: (...message: unknown[]) => void
    time: (name: string) => void
    timeEnd: (name: string) => void
  }
}

type PathRemaps = Record<string, string>

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
    date: Date
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

type Templates = Map<string, [inputPath: string, html: string]>

function isMemoryFile(value: unknown): value is MemoryOutputFile {
  return value != null && typeof value == "object" && "buffer" in value
}

function isExternalFile(value: unknown): value is ExternalOutputFile {
  return value != null && typeof value == "object" && "inputPath" in value
}

function hash(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex")
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

function getLayouts(inputDirectory: string): Templates {
  const templates: Templates = new Map()

  const templatesDirectory = path.join(inputDirectory, "_layouts")
  if (!fs.existsSync(templatesDirectory)) return templates

  for (const file of scan(templatesDirectory)) {
    const fileContents = fs.readFileSync(file.path, "utf8")

    const document = parseHTML(fileContents)
    resolveAttributesToAbsoluteInputPaths(templatesDirectory, document)

    templates.set(file.name, [file.path, document.toString()])
  }

  return templates
}

function replaceStart(text: string, searchValue: string, replaceValue: string): string {
  if (text.startsWith(searchValue)) {
    return replaceValue + text.slice(searchValue.length)
  }

  return text
}

function shouldSkipFilePath(
  relativeFilePath: string,
  ignoredPaths: string[] = [],
): [shouldSkip: boolean, reason: string] {
  const filename = path.basename(relativeFilePath)
  if (filename === "_config.js") return [false, ""]
  if (filename.startsWith("_")) return [true, "underscore_prefix"]

  for (const ignoredPath of ignoredPaths || []) {
    const normalizedIgnoredPath = path.normalize(ignoredPath)

    if (relativeFilePath.startsWith(normalizedIgnoredPath)) {
      return [true, "ignored_path"]
    }
  }

  return [false, ""]
}

function getCollectionEntryFromPath(relativeFilePath: string, pathRemaps: PathRemaps): CollectionEntry | undefined {
  if (!relativeFilePath.startsWith("_")) return

  const [rawName, rawDateAndSlug = ""] = relativeFilePath.split("/")

  const collectionName = rawName.replace(/^_/, "")
  // Get the date part of the string, so that "2022-04-15-my-file" becomes "2022-04-15".
  const date = rawDateAndSlug.match(/^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)/g)?.[0] || ""
  const slug = rawDateAndSlug.replace(`${date}-`, "")

  return {
    title: slug,
    path: path.join(pathRemaps[collectionName] ?? collectionName, slug),
    relativeInputPath: relativeFilePath,
    date: new Date(date),
    collection: collectionName,
    data: {},
  }
}

function absoluteInputPathToRelativeOutputPath(
  inputDirectory: string,
  absoluteInputPath: string,
  pathRemaps: PathRemaps,
): string {
  const relativeInputPath = path.relative(inputDirectory, absoluteInputPath)
  const collectionEntry = getCollectionEntryFromPath(relativeInputPath, pathRemaps)

  if (collectionEntry) {
    const [, , ...rest] = relativeInputPath.split("/")
    return path.join("/", path.join(collectionEntry.path, ...rest))
  }

  return path.join("/", relativeInputPath)
}

function concatAssetContents(
  outputDirectory: string,
  type: "css" | "js",
  contents: Set<string>,
  document: WillMutate<HTMLElement>,
  files: WillMutate<OutputFiles>,
) {
  let concatenatedContents = ""

  for (const content of contents) {
    switch (type) {
      case "css":
        concatenatedContents += content + "\n"
        continue

      case "js":
        concatenatedContents += `(function() {${content}})();` + "\n"
        continue

      default:
        assertNever(type, "Expected type to be handled")
    }
  }

  if (!concatenatedContents.trim()) return

  const fileID = hash(concatenatedContents)
  const relativeOutputPath = path.join("/", "assets", type, fileID + "." + type)

  switch (type) {
    case "css":
      document.append(`<link rel="stylesheet" href="${relativeOutputPath}"/ >`)
      break

    case "js":
      document.append(`<script src="${relativeOutputPath}" async defer></script>`)
      break

    default:
      assertNever(type, "Expected type to be handled")
  }

  files.set(fileID, {
    buffer: Buffer.from(concatenatedContents),
    outputPath: path.join(outputDirectory, relativeOutputPath),
  })
}

function collectAssetsFromPageData(
  currentDirectory: string,
  inputDirectory: string,
  outputDirectory: string,
  pathRemaps: PathRemaps,
  outputFiles: WillMutate<OutputFiles>,
  dependencies: WillMutate<Dependencies>,
  pageData: WillMutate<PageData>,
) {
  for (const [key, value] of Object.entries(pageData)) {
    const absoluteInputPath = resolveToAbsoluteInputPath(currentDirectory, value)
    if (!absoluteInputPath) continue

    const relativeOutputPath = absoluteInputPathToRelativeOutputPath(inputDirectory, absoluteInputPath, pathRemaps)
    pageData[key] = relativeOutputPath

    dependencies.add(absoluteInputPath)

    const fileID = hash(absoluteInputPath)
    outputFiles.set(fileID, {
      inputPath: absoluteInputPath,
      outputPath: path.join(outputDirectory, relativeOutputPath),
    })
  }
}

function collectAssetsFromDocument(
  inputDirectory: string,
  outputDirectory: string,
  pathRemaps: PathRemaps,
  logger: StaticBuildOptions["logger"],
  outputFiles: WillMutate<OutputFiles>,
  dependencies: WillMutate<Dependencies>,
  document: WillMutate<HTMLElement>,
) {
  const styles: Set<string> = new Set()
  const scripts: Set<string> = new Set()

  // @TODO(SPEED): No need to go over paths again and check since when resolving
  // we could keep a list and reuse it here. IT will be a big speed improvement
  // if this is done! ~600ms to ~130ms!
  for (const element of document.querySelectorAll("*")) {
    for (const [attributeName, attributeValue] of Object.entries(element.attributes)) {
      if (!attributeValue) {
        logger?.info(
          `Skipping "${attributeName}" attribute on <${element.tagName.toLowerCase()}>, value is empty or non-existent`,
        )
        continue
      }

      if (!element.tagName.startsWith("SB:") && !(attributeName.includes("src") || attributeName.includes("href"))) {
        logger?.info(
          `Skipping "${attributeName}" attribute on <${element.tagName.toLowerCase()}>, attribute is unsupported`,
        )
        continue
      }

      if (
        attributeValue.startsWith("http://") ||
        attributeValue.startsWith("https://") ||
        attributeValue.startsWith("mailto:")
      ) {
        logger?.info(
          `Skipping "${attributeName}" attribute on <${element.tagName.toLowerCase()}>, value is an external link`,
        )
        continue
      }

      if (!attributeValue.includes(".")) {
        logger?.info(
          `Skipping "${attributeName}" attribute on <${element.tagName.toLowerCase()}>, value does not extension \"/\"`,
        )
        continue
      }

      if (!attributeValue.startsWith(inputDirectory)) {
        logger?.info(
          `Skipping "${attributeName}" attribute on <${element.tagName.toLowerCase()}>, value does not start with input directory path`,
        )
        continue
      }

      const absoluteInputPath = attributeValue

      // @TODO: This won't happen because of the the resolve function that will
      // check if they exist before hand. Maybe resolving should not check if
      // file exists? Or we resolve here instead? Or we only resolve known
      // attributes? Life is hard.
      if (!fs.existsSync(absoluteInputPath)) {
        logger?.error(`Could not find asset: ${absoluteInputPath}`)
        continue
      }

      if (fs.statSync(absoluteInputPath).isDirectory()) {
        logger?.warn(`Skipping asset, path is a directory: ${absoluteInputPath}`)
        continue
      }

      const relativeOutputPath = absoluteInputPathToRelativeOutputPath(inputDirectory, absoluteInputPath, pathRemaps)
      const fileExtension = path.extname(absoluteInputPath)

      // Make sure dependency is added before processing so that there is always
      // a link to the original input file, even if for instance, the file
      // gets inlined and isn't referenced via a URL.
      dependencies.add(absoluteInputPath)

      switch (fileExtension) {
        case ".css": {
          styles.add(fs.readFileSync(absoluteInputPath, "utf8"))
          element.remove()
          continue
        }

        case ".js": {
          scripts.add(fs.readFileSync(absoluteInputPath, "utf8"))
          element.remove()
          continue
        }

        default: {
          if (fileExtension === ".svg" && element.hasAttribute("sb:inline")) {
            const svgContents = fs.readFileSync(absoluteInputPath, "utf8")

            const svgDocument = parseHTML(svgContents)
            const svgElement = svgDocument.querySelector("svg")
            if (!svgElement) continue

            for (const className of element.classList.values()) {
              svgElement.classList.add(className)
            }

            element.replaceWith(svgElement)
            continue
          }

          // At this point, attribute name represents an attribute that contains
          // a path because anything else is early returned above. For example,
          // the attribute name could be `src` or `href`.
          element.setAttribute(attributeName, path.join("/", relativeOutputPath))

          const fileID = hash(absoluteInputPath)
          outputFiles.set(fileID, {
            inputPath: absoluteInputPath,
            outputPath: path.join(outputDirectory, relativeOutputPath),
          })
          continue
        }
      }
    }
  }

  concatAssetContents(outputDirectory, "css", styles, document, outputFiles)
  concatAssetContents(outputDirectory, "js", scripts, document, outputFiles)
}

function collectInlineCodeFromDocument(
  outputDirectory: string,
  outputFiles: WillMutate<OutputFiles>,
  document: WillMutate<HTMLElement>,
) {
  const styles: Set<string> = new Set()
  const scripts: Set<string> = new Set()

  for (const element of document.querySelectorAll("style, script:not([src])")) {
    if (element.hasAttribute("sb:buildtime")) continue

    if (element.hasAttribute("sb:ignore")) {
      element.removeAttribute("sb:ignore")
      continue
    }

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

  concatAssetContents(outputDirectory, "css", styles, document, outputFiles)
  concatAssetContents(outputDirectory, "js", scripts, document, outputFiles)
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

    for (const entry of collectionNameToEntries[collectionName] || []) {
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
  const dependencies: Set<string> = new Set()

  const context: Context = {
    site: {
      url: options.baseURL || "",
      date: new Date(),
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

  if (options.watch) {
    preTemplateDocument.append(
      `<sb:include src="./node_modules/@anthonyec/staticbuild/dist/partials/_reloader.html" port="${reloader.getPort()}" />`,
    )
  }

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
      options.logger?.info(`Found page data for: ${absoluteFilePath}`)
    } catch (err: unknown) {
      options.logger?.error("Error parsing buildtime data\n> " + err)
    }

    element.remove()
  }

  // Setup page template if one exists.
  context.page.content = preTemplateDocument.toString()

  const currentDirectory = path.dirname(absoluteFilePath)
  const relativeInputDirectory = path.relative(options.inputDirectory, currentDirectory)
  const collectionEntry = getCollectionEntryFromPath(relativeInputDirectory, options.pathRemaps || {})

  if (collectionEntry) {
    context.page.date = collectionEntry?.date
  }

  const [layoutInputPath, layoutHtml] = collectionEntry && layouts ? layouts.get(collectionEntry.collection) || [] : []
  const template = layoutHtml ?? preTemplateDocument.toString()

  if (layoutInputPath) {
    dependencies.add(layoutInputPath)
  }

  // Render template.
  const html = Mustache.render(template, context)
  collectCollectionDependencies(options.inputDirectory, template, collectionNameToEntries, dependencies)

  // Parse the HTML ready for modification.
  let document = parseHTML(html)
  resolveAttributesToAbsoluteInputPaths(currentDirectory, document)

  // Resolve and inline all `<sb:include>` tags.
  //
  // This iteratively finds the first include element and replaces it with it's
  // rendered contents. This continues until no include elements are found. Nested
  // includes are handled naturally as newly inserted content is re-scanned.
  let currentIncludeElement = document.querySelector("sb\\:include")

  while (currentIncludeElement) {
    const src = currentIncludeElement.getAttribute("src")

    if (!src) {
      currentIncludeElement.remove()
      break
    }

    if (!path.basename(src).startsWith("_")) {
      options.logger?.error(`Included filenames must start with an underscore: ${path.basename(src)}`)
      currentIncludeElement.remove()
      break
    }

    if (!fs.existsSync(src)) {
      options.logger?.error(`Could not find include: ${src}`)
      currentIncludeElement.remove()
      break
    }

    const includeContents = fs.readFileSync(src, "utf8")
    const includeDocument = parseHTML(includeContents)
    resolveAttributesToAbsoluteInputPaths(path.dirname(src), includeDocument)

    const includeHtml = Mustache.render(includeDocument.toString(), {
      ...context,
      attributes: {
        ...currentIncludeElement.attributes,
        children: currentIncludeElement.innerHTML,
      },
    })

    currentIncludeElement.replaceWith(includeHtml)
    currentIncludeElement = document.querySelector("sb\\:include")

    dependencies.add(src)
  }

  // Execute buildtime script tags.
  for (const element of document.querySelectorAll("script[sb\\:buildtime]")) {
    if (element.getAttribute("type") && element.getAttribute("type") != "text/javascript") continue

    try {
      eval(element.textContent)
    } catch (err: unknown) {
      options.logger?.error("Error executing buildtime script\n> " + err)
    }

    element.remove()
  }

  for (const element of document.querySelectorAll("[sb\\:selector]")) {
    const selector = element.getAttribute("sb:selector")
    if (!selector) continue
    if (selector.includes(":hover") || selector.includes(":focus")) continue

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
    options.pathRemaps || {},
    outputFiles,
    dependencies,
    context.page.data,
  )
  collectAssetsFromDocument(
    options.inputDirectory,
    options.outputDirectory,
    options.pathRemaps || {},
    options.logger,
    outputFiles,
    dependencies,
    document,
  )
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

  inputDependencies.set(absoluteFilePath, dependencies)

  return [document.toString(), context.page]
}

export default async function staticbuild(options: StaticBuildOptions) {
  const reloader = createReloader()

  if (options.watch) {
    await reloader.start().catch((err) => {
      throw Error(err)
    })
  }

  const inputDependencies: InputDependencies = new Map()
  const collectionNameToEntries: CollectionEntries = {}

  const ignoredPaths = ["./_layouts", ...(options.ignoredPaths || [])]

  const build = async (changedFilePaths: string[] = []) => {
    const isCleanBuild = changedFilePaths.length === 0

    const outputFiles: OutputFiles = new Map()

    options.logger?.time("Built")

    if (isCleanBuild) {
      for await (const file of scan(options.inputDirectory)) {
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

      if (!isCleanBuild) {
        for (const [parent, dependencies] of inputDependencies) {
          if (dependencies.has(absoluteFilePath)) {
            filePathProcessStack.push(parent)
          }
        }
      }

      if (fs.statSync(absoluteFilePath).isDirectory()) continue

      const relativeFilePath = absoluteToRelativePath(options.inputDirectory, absoluteFilePath)
      const [shouldSkipFile, skipFileReason] = shouldSkipFilePath(relativeFilePath, ignoredPaths)

      if (shouldSkipFile) {
        options.logger?.info(`Skip file because ${skipFileReason}:`, relativeFilePath)
        continue
      }

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
                for (const file of scan(absoluteInputPath)) {
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

          const collectionEntry = getCollectionEntryFromPath(relativeFilePath, options.pathRemaps || {})
          if (!collectionEntry) continue

          const layouts = getLayouts(options.inputDirectory)

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
          const layouts = getLayouts(options.inputDirectory)

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

          const collectionEntry = getCollectionEntryFromPath(relativeFilePath, options.pathRemaps || {})

          const outputPath = collectionEntry
            ? path.join(options.outputDirectory, collectionEntry.path, path.basename(absoluteFilePath))
            : path.join(options.outputDirectory, relativeFilePath)

          outputFiles.set(fileID, {
            buffer: Buffer.from(renderedPage),
            outputPath,
          })
          break
        }

        case ".txt":
        case ".xml": {
          const fileContents = fs.readFileSync(absoluteFilePath, "utf8")
          const context: Context = {
            site: {
              url: options.baseURL || "",
              date: new Date(),
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

          const collectionEntry = getCollectionEntryFromPath(relativeFilePath, options.pathRemaps || {})

          const outputPath = collectionEntry
            ? path.join(options.outputDirectory, collectionEntry.path, path.basename(absoluteFilePath))
            : path.join(options.outputDirectory, relativeFilePath)

          outputFiles.set(fileID, {
            buffer: Buffer.from(html),
            outputPath,
          })
          break
        }

        default:
          continue
      }
    }

    options.logger?.timeEnd("Built")

    options.logger?.time("Write")

    for (const [_, file] of outputFiles) {
      const buffer: Buffer<ArrayBuffer> = isExternalFile(file)
        ? Buffer.from(fs.readFileSync(file.inputPath))
        : file.buffer

      if (options.dryRun) {
        options.logger?.info("[fake_file_write]")

        if (isExternalFile(file)) {
          options.logger?.info(" in: " + file.inputPath)
        } else {
          options.logger?.info(" in: " + `(buffer ${file.buffer.length} bytes)`)
        }

        options.logger?.info(" out: " + file.outputPath)
      } else {
        assert(
          file.outputPath.startsWith(options.outputDirectory),
          `Expected file to be placed inside output directory:\n Output directory: ${options.outputDirectory}\n Actual output path: ${file.outputPath}`,
        )

        // Small form of optimization. Don't write file if there no changes.
        if (fs.existsSync(file.outputPath)) {
          if (Buffer.compare(buffer, fs.readFileSync(file.outputPath)) === 0) continue
        }

        fs.mkdirSync(path.dirname(file.outputPath), { recursive: true })
        fs.writeFileSync(file.outputPath, buffer)
      }
    }

    options.logger?.timeEnd("Write")

    if (options.check) {
      options.logger?.info("Check")

      for (const [_, file] of outputFiles) {
        if (!file.outputPath.endsWith(".html")) continue

        const html = fs.readFileSync(file.outputPath, "utf8")
        const document = parseHTML(html)

        for (const element of document.querySelectorAll("a[href]")) {
          const href = element.getAttribute("href")
          if (!href?.startsWith("http")) continue

          try {
            const response = await fetch(href, { signal: AbortSignal.timeout(5000) })

            if (response.status < 200 || response.status > 299) {
              options.logger?.info(`Response ${response.status}: ${href}`)
            }
          } catch (err: unknown) {
            options.logger?.info(`Timeout: ${href}`)
          }
        }
      }
    }

    options.logger?.info(`Count: ${outputFiles.size} file(s)`)
    options.logger?.info(`Done (${new Date()})`)
  }

  await build()

  if (options.watch) {
    options.logger?.info("---")
    options.logger?.info("👀 Watching for changes...")

    await watcher(options.inputDirectory, async (changedFilePaths) => {
      options.logger?.info("---")

      try {
        await build(changedFilePaths)
        reloader.reload()
      } catch (err) {
        options.logger?.info("error:", err)
      }
    })
  }
}
