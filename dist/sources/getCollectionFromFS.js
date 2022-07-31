"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const markdown = __importStar(require("markdown-wasm"));
const fs_1 = require("../utils/fs");
/** Return the title found between `h1` tags in a HTML string. */
function getTitleFromHTML(html) {
    const match = html.match(/\<h1\>.*\<\/h1\>/g);
    if (match?.length) {
        return (match[0]
            // Remove A and H1 tags.
            .replace(/<a\s.*<\/a>/g, '')
            .replace('<h1>', '')
            .replace('</h1>', ''));
    }
    else {
        return '';
    }
}
/** Returns the YYYY-MM-DD date from a filename.
 *
 * Example: `2022-04-15-my-file` becomes `2022-04-15` */
function getDateFromFilename(filename) {
    const dateMatch = filename.match(/^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)/g);
    return (dateMatch && dateMatch[0]) || '';
}
/** Returns key and value pairs found in comment props.
 *
 * Example: `<!-- key: value -->` becomes `{ key: "value" }`
 *
 * This will only parse comment props found at the start of a string, and will
 * stop parsing as soon as it encounters anything that isn't a comment prop.
 **/
function getCommentPropsFromContent(content) {
    const props = {};
    const contentSplitByNewLines = content.split('\n');
    let lineReached = 0;
    for (const line of contentSplitByNewLines) {
        const match = line.match(/\<\!--\s?(.+)\s?:\s?(.+)\s?--\>/);
        if (!match) {
            break;
        }
        const key = match[1].trim();
        const value = match[2].trim();
        props[key] = value;
        lineReached += 1;
    }
    const contentWithoutCommentProps = contentSplitByNewLines
        .slice(lineReached, contentSplitByNewLines.length)
        .join('\n');
    return [props, contentWithoutCommentProps];
}
/**
 * Creates pages belonging to a collection based on a specific directory structure.
 * Pages are returned sorted by date.
 *
 * The directory must follow this structure:
 * ```txt
 * |- collectionName
 * |  |- YYYY-MM-DD-entry-slug
 * |  |  |- index.md
 * ```
 *
 * ## Assets
 * Other assets can be stored within a collection directory, in any structure, and
 * will be copied relative to the output.
 *
 * For example, `./src/_projects/2022-04-24-my-cool-project/images/screenshot.jpg` will be
 * copied to `./dist/projects/my-cool-project/images/screenshot.jpg`
 *
 * ## Example usage
 * ```js
 * const projectPages = getCollectionFromFS({
 *  name: 'projects',
 *  defaultLayout: 'project',
 *  inputDirectory: './src/_projects',
 *  outputDirectory: './dist/{{slug}}'
 * });
 * ```
 **/
async function getCollectionFromFS(options) {
    const pages = [];
    const files = await (0, fs_1.getDirectoryNames)(options.inputDirectory);
    for await (const file of files) {
        const markdownFilePath = path.join(options.inputDirectory, file, 'index.md');
        const doesMarkdownFileExist = await (0, fs_1.checkFileExists)(markdownFilePath);
        // Avoid any folders that have no markdown files.
        if (!doesMarkdownFileExist) {
            continue;
        }
        const markdownFileContents = await fs.readFile(markdownFilePath, 'utf8');
        const content = markdown.parse(markdownFileContents);
        const title = getTitleFromHTML(content);
        const date = getDateFromFilename(file);
        const [props, contentWithoutCommentProps] = getCommentPropsFromContent(content);
        const slug = file.replace(`${date}-`, '');
        const outputDirectory = options.outputDirectory.replaceAll('{{slug}}', slug);
        const outputPath = path
            .join(options.outputDirectory, 'index.html')
            .replaceAll('{{slug}}', slug);
        // TODO: This is harc-coded to remove `./dist` but it should be dynamic.
        // Should it just remove the first part of the path or should the
        // `./dist` directory be passed in and subtracted from the path?
        const url = outputDirectory.replace('./dist', '');
        const assetPaths = await (0, fs_1.recursiveReadDirectory)(path.join(options.inputDirectory, file));
        const assetsWithoutMarkdownFile = assetPaths.filter((assetPath) => {
            return assetPath !== markdownFilePath;
        });
        // TODO: Tidy this up, especially the stuff with repeated {{slug}} path construction.
        const assets = assetsWithoutMarkdownFile.map((assetPath) => {
            const assetPathRelativeToCollection = path.relative(path.join(options.inputDirectory, file), assetPath);
            const assetFileName = path.basename(assetPath);
            return {
                filename: assetFileName,
                inputPath: assetPath,
                outputPath: path.join(options.outputDirectory.replaceAll('{{slug}}', slug), assetPathRelativeToCollection)
            };
        });
        const page = {
            title,
            slug,
            url,
            layout: options.defaultLayout,
            date: new Date(date),
            collection: options.name,
            outputPath,
            content: contentWithoutCommentProps,
            assets,
            // Page comment props can override anything, so be careful (or have fun)!
            ...props
        };
        pages.push(page);
    }
    return pages;
}
exports.default = getCollectionFromFS;
//# sourceMappingURL=getCollectionFromFS.js.map