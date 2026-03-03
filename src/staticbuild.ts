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

const files: Map<FileID, File> = new Map()
const dependencies: Map<FileID, Set<FileID>> = new Map()

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

function createDependency(from: FileID, to: FileID) {
  const existingDependencies = dependencies.get(from) || new Set()
  existingDependencies.add(to)

  dependencies.set(from, existingDependencies)
}

function removeDependency(a: FileID, b: FileID) {
  dependencies.delete(a)
}

function getDependenciesFor(fileID: FileID): File[] {
  return []
}

export default async function staticbuild(options: StaticBuildOptions) {
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

        for (const dependency of getDependenciesFor(fileID)) {
          // Remove link
          // If link to file was last link, remove file and repeat.
        }

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

          for (const externalSourceElement of document.querySelectorAll("img, video, script, link")) {
            const sourcePath = externalSourceElement.getAttribute("src") || externalSourceElement.getAttribute("href")
            if (!sourcePath) continue
            if (sourcePath.startsWith("http")) continue

            const inputSourcePath = path.normalize(path.join(options.inputDirectory, sourcePath))
            if (!fs.existsSync(inputSourcePath)) continue

            const sourceFileID = hash(inputSourcePath)
            const outputPath = path.join(
              options.outputDirectory,
              "assets",
              sourceFileID + path.extname(inputSourcePath),
            )

            files.set(sourceFileID, {
              inputPath: inputSourcePath,
              outputPath,
            })

            createDependency(fileID, sourceFileID)
          }

          files.set(fileID, {
            inputPath: absoluteFilePath,
            outputPath: path.join(options.outputDirectory, relativeFilePath),
          })

          for (const inlineCodeElement of document.querySelectorAll("style, script:not([src])")) {
            const textContent = inlineCodeElement.textContent
            const inlineCodeFileID = hash(textContent)
            const inlineCodeExtension = inlineCodeElement.tagName == "STYLE" ? ".css" : ".js"

            files.set(inlineCodeFileID, {
              buffer: Buffer.from(textContent),
              outputPath: path.join(options.outputDirectory, "assets", inlineCodeFileID + inlineCodeExtension),
            })

            createDependency(fileID, inlineCodeFileID)
          }

          files.set(fileID, {
            inputPath: absoluteFilePath,
            outputPath: path.join(options.outputDirectory, relativeFilePath),
          })
        }

        default:
          continue
      }
    }

    console.log(files)
    console.log(dependencies)

    for (const [filename, file] of files) {
      const buffer: Buffer<ArrayBuffer> = isExternalFile(file)
        ? Buffer.from(fs.readFileSync(file.inputPath))
        : file.buffer

      fs.mkdirSync(path.dirname(file.outputPath), { recursive: true })
      fs.writeFileSync(file.outputPath, buffer)

      //   let combinedCssFilename = ""
      //   let combinedCssContents = ""

      //   for (const asset of page.assets) {
      //     if (!isExternalAsset(asset)) continue

      //     if (asset.type == "css") {
      //       combinedCssFilename += path.basename(asset.inputPath)
      //       combinedCssContents += fs.readFileSync(asset.inputPath, "utf8")
      //     }
      //   }

      //   const cssFilename = hash(combinedCssFilename) + ".css"
      //   const cssOutputDirectory = path.join(options.outputDirectory, "./assets/css")
      //   fs.mkdirSync(cssOutputDirectory, { recursive: true })
      //   fs.writeFileSync(path.join(cssOutputDirectory, cssFilename), combinedCssContents)

      //   const root = parseHTML(page.html)
      //   let headElement = root.querySelector("head")

      //   if (!headElement) {
      //     headElement = parseHTML("<head></head>")
      //     root.prepend(headElement)
      //   }

      //   headElement.append(`<link rel="" href="/assets/css/${cssFilename}">`)
      //   page.html = root.toString()

      //   const outputPath: string = path.join(options.outputDirectory, page.inputPath)
      //   fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      //   fs.writeFileSync(outputPath, page.html)
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
