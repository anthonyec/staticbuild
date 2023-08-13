import { checkFileExists, requireUncached } from '../utils/fs';

interface Config {
  directories: {
    layouts: string;
    partials: string;
    functions: string;
    data: string;
    hooks: string;
  };
  getPages: () => Promise<Page[]>;
  getAssets: () => Promise<Asset[]>;
}

const DEFAULT_CONFIG: Config = {
  directories: {
    layouts: './src/_layouts',
    partials: './src/_partials',
    functions: './src/_functions',
    data: './src/_data',
    hooks: './src/_hooks'
  },
  getPages: async () => [],
  getAssets: async () => []
};

export function getUserConfig(configPath: string): Config {
  if (!(checkFileExists(configPath))) {
    return DEFAULT_CONFIG;
  }

  const userConfig = requireUncached<Config>(configPath);

  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    directories: {
      ...DEFAULT_CONFIG.directories,
      ...userConfig.directories
    }
  };
}
