export function getEnvironmentConfig(): Env {
  return {
    devMode: process.env.NODE_ENV === 'dev'
  };
}
