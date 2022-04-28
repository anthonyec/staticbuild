import * as fs from 'fs/promises';
import * as path from 'path';
import * as mustache from 'mustache';

import { getUserConfig } from './config';
import { getLayoutsFromFS } from './sources/getLayoutsFromFS';
import { getFunctionsFromFS } from './sources/getFunctionsFromFS';
import { recursiveReadDirectory } from './utils/fs';

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
  layouts: {
    [name: string]: string;
  };
  partials: {
    [name: string]: string;
  };
  functions: {
    [name: string]: () => () => unknown; // TODO: Type?
  };
  collections: {
    [name: string]: Page[];
  };
  data: {
    // TODO: Add better types.
    [name: string]: object | ((globals: Globals) => object);
  };
}

// Equivalent to supplied data in Eleventry:
// https://www.11ty.dev/docs/data-eleventy-supplied/#eleventy-supplied-data
interface Globals {
  env: {
    devMode: boolean;
  };
  data: object;
  functions: object;
  collections: object;
  page: Page;
}

function getObjectWithFunctionsInvoked<T, A>(
  object: T,
  invokedFunctionArgument: A
): T {
  const clonedObject: T = { ...object };

  for (const key in clonedObject) {
    const value = clonedObject[key];

    if (typeof value === 'function') {
      clonedObject[key] = value(invokedFunctionArgument);
    }
  }

  return clonedObject;
}

function withComputedValues<T>(
  namespacesToCompute: string[],
  originalStructure: T
): T {
  const clonedOriginalStructure: T = { ...originalStructure };

  for (const namespace of namespacesToCompute) {
    // As keyof T solution found here:
    // https://stackoverflow.com/questions/55012174/why-doesnt-object-keys-return-a-keyof-type-in-typescript/55012175#55012175
    const namespaceObject = clonedOriginalStructure[namespace as keyof T];

    clonedOriginalStructure[namespace as keyof T] =
      getObjectWithFunctionsInvoked(namespaceObject, originalStructure);
  }

  return clonedOriginalStructure;
}

async function buildPages(options: BuildPagesOptions) {
  const DEFAULT_EMPTY_LAYOUT = '{{{page.content}}}';

  for await (const page of options.pages) {
    const outputDirectory = path.dirname(page.outputPath);
    const template =
      (page.layout && options.layouts[page.layout]) || DEFAULT_EMPTY_LAYOUT;

    const globals: Globals = withComputedValues<Globals>(['data'], {
      env: {
        devMode: process.env.NODE_ENV === 'dev'
      },
      functions: options.functions,
      collections: options.collections,
      data: options.data,
      page
    });

    const renderedPage = mustache.render(template, globals, options.partials);

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

// TODO: Decide where this should live.
function getAssetsFromPages(pages: Page[]): Asset[] {
  const assets: Asset[] = [];

  for (const page of pages) {
    if (page.assets) {
      assets.push(...page.assets);
    }
  }

  return assets;
}

// TODO: Decide where this should live.
async function copyAssets(assets: Asset[]) {
  for await (const asset of assets) {
    await fs.cp(asset.inputPath, asset.outputPath);
  }
}

export default async function staticbuild(options: StaticBuildOptions) {
  console.time('setup');
  const config = getUserConfig(options.configPath);

  // await resetOutputDirectory(options.outputDirectory);

  // const hooks = await getFunctionsFromFS(config.directories.hooks);
  // TODO: Is it possible for these functions to use a shared sourcing func?
  // TODO: Add checks that paths exist.
  const functions = await getFunctionsFromFS(config.directories.functions);
  const data = await getFunctionsFromFS(config.directories.data);
  const layouts = await getLayoutsFromFS(config.directories.layouts);
  const partials = await getLayoutsFromFS(config.directories.partials);
  console.timeEnd('setup');

  console.time('source');
  const pages = await config.getPages();
  // const assets = await config.getAssets();
  const collections = getCollectionsFromPages(pages);
  console.timeEnd('source');

  console.time('copy');
  const assetsFromPages = getAssetsFromPages(pages);
  // const assetsToCopy = await getAssetsFilteredByChanges([...assets, ...assetsFromPages], changeList);

  await copyAssets(assetsFromPages);
  console.timeEnd('copy');

  console.time('render');
  await buildPages({
    pages,
    layouts,
    partials,
    functions,
    collections,
    data
  });
  console.timeEnd('render');

  // console.time('clean');
  // await recursiveReadDirectory(options.inputDirectory);
  // console.timeEnd('clean')

  // hooks.onPostBuild();
}
