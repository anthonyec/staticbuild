interface Asset {
  /** Name of the file including extension, e.g `image.png` */
  filename: string;
  /** Path of source file */
  inputPath: string;
  /** Path of where the file will be copied to */
  outputPath: string;
}

interface Page {
  /** Page title, e.g `My Cool Page` */
  title: string;
  /** Slugified name which can be used in URLs, e.g `my-cool-page` */
  slug?: string;
  /** Date the page was created */
  date?: Date;
  /** Name used to group page into a collection, e.g `blog`*/
  collection?: string;
  /** Name of the layout to use, e.g `post` */
  layout?: string;
  /** Content of the page, usually HTML but could be anything */
  content: string;
  /** Path of where the built page will go */
  outputPath: string;
  /** Related files to be copied with the page */
  assets?: Asset[];
}

/**
 * Variables that are supplied to every rendered page.
 *
 * They are equivalent to [Eleventy supplied data](https://www.11ty.dev/docs/data-eleventy-supplied/) or [Jekyll global variables](https://jekyllrb.com/docs/variables/).
 */
interface RenderGlobals {
  env: {
    devMode: boolean;
  };
  /** Custom data that is provided by either `.js` or `.json` files in the `_data` directory. */
  data: object;
  /** Custom functions that are provided by .js` files that export functions in the `_functions` directory. */
  functions: object;
  /** List of all pages grouped by their `collection` attribute.  */
  collections: object;
  /** Information about the current page, including comment props. */
  page: Page;
}
