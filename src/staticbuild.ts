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

interface Config {
  directories?: {
    layouts?: string;
    partials?: string;
    functions?: string;
    data?: string;
    hooks?: string;
  };
  getPages: () => Page[];
  getAssets: () => Asset[];
}

const DEFAULT_CONFIG: Config = {
  directories: {
    layouts: './src/_layouts',
    partials: './src/_partials',
    functions: './src/_functions',
    data: './src/_data',
    hooks: './src/_hooks',
  },
  getPages: () => [],
  getAssets: () => [],
};

function requireUncached<T>(module: string): T {
  delete require.cache[require.resolve(module)];
  return require(module);
}

export default async function staticbuild(options: StaticBuildOptions) {
  const config: Config = {
    ...DEFAULT_CONFIG,
    ...requireUncached<Config>(options.configPath),
  };

  // await resetOutputDirectory(options.outputDirectory);

  // const functions = await getFunctionsFromFS(config.directories?.functions);
  // const layouts = await getLayoutsFromFS(config.directories?.layouts);
  // const partials = await getPartialsFromFS(config.directories?.partials);
  // const data = await getDataFromFS(config.directories?.data);
  // const hooks = await getHooksFromFS(config.directories?.hooks);

  const pages = await config.getPages();
  // const assets = await config.getAssets();

  // console.log(pages);
}
