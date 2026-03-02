// https://bobbyhadz.com/blog/typescript-property-status-does-not-exist-on-type-error
interface Error {
  code?: string;
}

interface Args {
  watch?: boolean;
}

interface Asset {
  /** Name of the file including the extension, e.g `image.png` */
  filename: string;
  /** Path of source file */
  inputPath: string;
  /** Path of where the file will be copied to */
  outputPath: string;
}

interface Page {
  /** Page title, e.g `My Cool Page` */
  title: string;
  /** URL that can be used to link to the page, e.g with `<a href>` */
  url: string;
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

interface EnvironmentVariables {
  devMode: boolean;
}

interface Hooks {
  onRenderPage: (context: RenderContext, template: string) => string;
}

type Collections = { [name: string]: Page[] };

type MustacheFunction = () => (
  text: string,
  subRender: (template: string) => string
) => string;

/**
 * Info that is supplied to every page when being rendered.
 *
 * They are equivalent to [Eleventy supplied data](https://www.11ty.dev/docs/data-eleventy-supplied/) or [Jekyll global variables](https://jekyllrb.com/docs/variables/).
 */
interface RenderContext {
  env: EnvironmentVariables;
  /**
   * Custom data object that is returned from either a `.js` or `.json` file in
   * the `_data` directory.
   *
   * If using a `.js` file, a function (async or sync) can be used to compute
   * data and return it as an object.
   * */
  data: {
    [name: string]:
      | object
      | ((context: RenderContext) => object)
      | Promise<(context: RenderContext) => object>;
  };
  /**
   * Custom template functions that are provided by `.js` files in the
   * `_functions` directory.
   * */
  functions: {
    [name: string]: MustacheFunction;
  };
  /** List of all pages grouped by their `collection` attribute.  */
  collections: Collections;
  /** Information about the current page, including comment props. */
  page: Page;
}
