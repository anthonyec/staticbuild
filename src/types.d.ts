interface StaticBuildOptions {
  /** Specify an input folder containing website source files */
  inputDirectory: string;

  /** Specify an output folder for the website to be built to */
  outputDirectory: string;

  /** Watch files in the `outputDirectory and build when they change */
  watch?: boolean;
}

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

interface CollectionSettings {
  /** Name of the collection */
  name: string;

  /** Name of the layout to use if not overridden by the page */
  defaultLayout: string;

  /** Path of source files following the collection directory structure */
  inputDirectory: string;

  /** Path of where the built pages will go.
   *
   * The following template variables can be used: `{{slug}}` */
  outputDirectory: string;
}
