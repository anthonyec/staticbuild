export function getEnvironmentConfig(): EnvironmentVariables {
  return {
    devMode: process.env.NODE_ENV === 'dev'
  };
}
