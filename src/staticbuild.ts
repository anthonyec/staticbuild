import * as fs from 'fs/promises';
import * as path from 'path';
import * as mustache from 'mustache';

import { getUserConfig } from './config';
import { getLayoutsFromFS } from './sources/getLayoutsFromFS';

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
  // /** Specify an input folder containing website source files */
  // inputDirectory: string;
  // /** Specify an output folder for the website to be built to */
  // outputDirectory: string;
  pages: Page[];
  layouts?: {
    [key: string]: string;
  };
  // onBuildPage?: () => void
}

async function buildPages(options: BuildPagesOptions) {
  const DEFAULT_EMPTY_LAYOUT = '{{{page.content}}}';

  for await (const page of options.pages) {
    const outputDirectory = path.dirname(page.outputPath);

    const template =
      page.layout && options.layouts && options.layouts[page.layout]
        ? options.layouts[page.layout]
        : DEFAULT_EMPTY_LAYOUT; // Default empty layout.

    const pageView = { page };
    const renderedPage = mustache.render(template, pageView);

    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(page.outputPath, renderedPage, 'utf8');
  }
}

export default async function staticbuild(options: StaticBuildOptions) {
  console.time('setup');
  const config = getUserConfig(options.configPath);

  // await resetOutputDirectory(options.outputDirectory);

  // const functions = await getFunctionsFromFS(config.directories?.functions);
  const layouts = await getLayoutsFromFS(config.directories.layouts);
  // const partials = await getPartialsFromFS(config.directories?.partials);
  // const data = await getDataFromFS(config.directories?.data);
  // const hooks = await getHooksFromFS(config.directories?.hooks);
  console.timeEnd('setup');

  console.time('source');
  const pages = await config.getPages();
  const assets = await config.getAssets();
  console.timeEnd('source');

  // console.time('copy');
  // const assetsFromPages = await getAssetsFromPages(pages);
  // const assetsToCopy = await getAssetsFilteredByChanges([...assets, ...assetsFromPages], changeList);

  // await copyAssets(assetsToCopy);
  // console.timeEnd('copy');

  console.time('build');
  await buildPages({
    // inputDirectory: options.inputDirectory,
    // outputDirectory: options.outputDirectory,
    pages,
    layouts,
  });
  console.timeEnd('build');
}
