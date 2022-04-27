import * as fs from 'fs/promises';
import * as path from 'path';
import * as mustache from 'mustache';

import { getUserConfig } from './config';
import { getLayoutsFromFS } from './sources/getLayoutsFromFS';
import { getFunctionsFromFS } from './sources/getFunctionsFromFS';

interface StaticBuildOptions {
  /** Specify an input folder containing website source files */
  inputDirectory: string;
  /** Specify an output folder for the website to be built to */
  outputDirectory: string;
  /** Specify path of the website config file */
  configPath: string;
  /** Watch files in the `outputDirectory and build when they change */
  watch?: boolean;
}

interface BuildPagesOptions {
  pages: Page[];
  // TODO: Should all these options be optional?
  layouts?: {
    [key: string]: string;
  };
  partials?: {
    [key: string]: string;
  };
  functions?: {
    [key: string]: () => () => unknown; // TODO: Type?
  };
  collections?: {
    [key: string]: Page[];
  };
  data?: {
    // TODO: Add better types.
    [key: string]: object | ((templateGlobal: TemplateGlobal) => object);
  };
}

// TODO: Come up with name and type for this global view thingy.
// Equivalent to supplied data in Eleventry:
// https://www.11ty.dev/docs/data-eleventy-supplied/#eleventy-supplied-data
interface TemplateGlobal {
  env: object;
  data: object;
  functions: object;
  collections: object;
  page: Page;
}

// TODO: Give it a better name.
function executeGetters(
  templateGlobal: TemplateGlobal,
  data: Pick<BuildPagesOptions, 'data'>
) {
  const newData: { [key: string]: object } = {};

  for (const key in data) {
    // @ts-ignore
    const value = data[key];

    if (typeof value === 'function') {
      newData[key] = value(templateGlobal);
    } else {
      newData[key] = value;
    }
  }

  return newData;
}

async function buildPages(options: BuildPagesOptions) {
  const DEFAULT_EMPTY_LAYOUT = '{{{page.content}}}';

  for await (const page of options.pages) {
    const outputDirectory = path.dirname(page.outputPath);

    const template =
      page.layout && options.layouts && options.layouts[page.layout]
        ? options.layouts[page.layout]
        : DEFAULT_EMPTY_LAYOUT; // Default empty layout.

    // TODO: Clean this up and document it. Is this the best way to do it?
    const templateGlobalsBeforeGettersExecuted: TemplateGlobal = {
      env: {},
      data: {
        ...options.data,
      },
      functions: {
        // TODO: Should the object be remade like this? Or should it reuse
        // the reference like `functions: options.functions`?
        ...options.functions,
      },
      collections: {
        ...options.collections,
      },
      page,
    };

    const executedDataGetters = executeGetters(
      templateGlobalsBeforeGettersExecuted,
      templateGlobalsBeforeGettersExecuted.data
    );

    const templateGlobals: TemplateGlobal = {
      ...templateGlobalsBeforeGettersExecuted,
      data: {
        ...templateGlobalsBeforeGettersExecuted.data,
        ...executedDataGetters,
      },
    };

    const renderedPage = mustache.render(
      template,
      templateGlobals,
      options.partials
    );

    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(page.outputPath, renderedPage, 'utf8');
  }
}

// TODO: Rewrite and tidy up.
function getCollectionsFromPages(pages: Page[]): { [key: string]: Page[] } {
  return pages.reduce((acc, page) => {
    if (page.collection) {
      // @ts-ignore
      if (!acc[page.collection]) {
        // @ts-ignore
        acc[page.collection] = [page];
      } else {
        // @ts-ignore
        acc[page.collection].push(page);
      }
    }

    return acc;
  }, {});
}

export default async function staticbuild(options: StaticBuildOptions) {
  console.time('setup');
  const config = getUserConfig(options.configPath);

  // await resetOutputDirectory(options.outputDirectory);

  // const hooks = await getFunctionsFromFS(config.directories.hooks);
  // TODO: Is it possible for these functions to use a shared sourcing func?
  const functions = await getFunctionsFromFS(config.directories.functions);
  const data = await getFunctionsFromFS(config.directories.data);
  const layouts = await getLayoutsFromFS(config.directories.layouts);
  const partials = await getLayoutsFromFS(config.directories.partials);

  // const data = await getDataFromFS(config.directories?.data);
  console.timeEnd('setup');

  console.time('source');
  const pages = await config.getPages();
  // const assets = await config.getAssets();
  const collections = getCollectionsFromPages(pages);
  console.timeEnd('source');

  // console.time('copy');
  // const assetsFromPages = await getAssetsFromPages(pages);
  // const assetsToCopy = await getAssetsFilteredByChanges([...assets, ...assetsFromPages], changeList);

  // await copyAssets(assetsToCopy);
  // console.timeEnd('copy');

  console.time('build');
  await buildPages({
    pages,
    layouts,
    partials,
    functions,
    collections,
    data,
  });
  console.timeEnd('build');
  // hooks.onPostBuild();
}
