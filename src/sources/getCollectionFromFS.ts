import * as fs from 'fs/promises';

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
  settings: CollectionSettings
): Promise<Page[]> {
  const collectionDirectories = await fs.readdir(settings.inputDirectory);

  console.log(collectionDirectories);

  return [
    {
      title: 'One year of Salad Room',
      slug: 'one-year-of-salad-room',
      collection: 'projects',
      date: new Date(),
      content: 'Hello there!',
      layout: 'project',
      outputPath: 'projects/one-year-of-salad-room',
    },
  ];
}
