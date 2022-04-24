interface Redirects {
  /** Redirect from "key" to "value", e.g `'/work/dashboard': '/posts/improving-car-dashboards-slightly'` */
  [from: string]: string;
}

/**
 * Creates pages that redirect to other URLs.
 *
 * ## Example usage
 * ```js
 * const redirectPages = getRedirectsFromMap({
 *  // Redirect from one path to another.
 *  '/work/dashboard': '/posts/improving-car-dashboards-slightly',
 *
 *  // Redirect from path to external URL.
 *  '/redirects/google': 'https://google.com'
 * });
 * ```
 */
export default async function getRedirectsFromMap(
  redirects: Redirects
): Promise<Page[]> {
  return [
    {
      title: 'Redirect to {}',
      content: '`<link href>',
      outputPath: 'projects/one-year-of-salad-room',
    },
  ];
}
