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
export default function getCollectionFromFS(options: CollectionOptions): Promise<Page[]>;
export {};
