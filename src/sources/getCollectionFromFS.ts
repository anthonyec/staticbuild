import * as fs from 'fs/promises';
import * as path from 'path';
import * as markdown from 'markdown-wasm';

import { checkFileExists, getDirectoryNames } from '../utils/fs';

interface CollectionOptions {
  /** Name of the collection */
  name: string;
  /** Name of the layout to use if not overridden by the page */
  defaultLayout: string;
  /** Path of source files following the collection directory structure */
  inputDirectory: string;
  /** Path of where the built pages will go. Template variables that can be used: `{{slug}}` */
  outputDirectory: string;
}

interface CommentProps {
  [key: string]: string;
}

/** Return the title found between `h1` tags in a HTML string. */
function getTitleFromHTML(html: string): string {
  const match = html.match(/\<h1\>.*\<\/h1\>/g);

  if (match?.length) {
    return (
      match[0]
        // Remove A and H1 tags.
        .replace(/<a\s.*<\/a>/g, '')
        .replace('<h1>', '')
        .replace('</h1>', '')
    );
  } else {
    return '';
  }
}

/** Returns the YYYY-MM-DD date from a filename.
 *
 * Example: `2022-04-15-my-file` becomes `2022-04-15` */
function getDateFromFilename(filename: string): string {
  const dateMatch = filename.match(
    /^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)/g
  );
  return (dateMatch && dateMatch[0]) || '';
}

/** Returns key and value pairs found in comment props.
 *
 * Example: `<!-- key: value -->` becomes `{ key: "value" }`
 *
 * This will only parse comment props found at the start of a string, and will
 * stop parsing as soon as it encounters anything that isn't a comment prop.
 **/
function getCommentPropsFromContent(content: string): [CommentProps, string] {
  const props: CommentProps = {};
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
export default async function getCollectionFromFS(
  options: CollectionOptions
): Promise<Page[]> {
  const pages = [];
  const files = await getDirectoryNames(options.inputDirectory);

  for await (const file of files) {
    const markdownFilePath = path.join(
      options.inputDirectory,
      file,
      'index.md'
    );
    const doesMarkdownFileExist = await checkFileExists(markdownFilePath);

    // Avoid any folders that have no markdown files.
    if (!doesMarkdownFileExist) {
      continue;
    }

    const markdownFileContents = await fs.readFile(markdownFilePath, 'utf8');
    const content = markdown.parse(markdownFileContents);
    const title = getTitleFromHTML(content);
    const date = getDateFromFilename(file);
    const [headers, contentWithoutCommentProps] =
      getCommentPropsFromContent(content);
    const slug = file.replace(`${date}-`, '');
    const outputPath = path
      .join(options.outputDirectory, 'index.html')
      .replaceAll('{{slug}}', slug);

    const page: Page = {
      title,
      slug,
      layout: options.defaultLayout,
      date: new Date(date),
      collection: options.name,
      outputPath,
      content: contentWithoutCommentProps,

      // TODO: Get assets for real.
      assets: [],

      // Page comment props can override anything, so be careful (or have fun)!
      ...headers,
    };

    pages.push(page);
  }

  return pages;
}
