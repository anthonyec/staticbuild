import { requireUncached } from './utils/fs';

interface Config {
  directories: {
    layouts: string;
    partials: string;
    functions: string;
    data: string;
    hooks: string;
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
    hooks: './src/_hooks'
  },
  getPages: () => [],
  getAssets: () => []
};

export function getUserConfig(configPath: string): Config {
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
