import * as path from 'path';

interface Redirects {
  [from: string]: string;
}

interface RedirectOptions {
  outputDirectory: string;
  redirects: Redirects;
}

export default function getRedirectsFromMap(options: RedirectOptions) {
  const redirectPages: Page[] = [];

  for (const redirectFrom in options.redirects) {
    const redirectTo = options.redirects[redirectFrom];
    const content = `<link href="${redirectTo}" rel="canonical"><meta http-equiv="refresh" content="0;url=${redirectTo}" />This page has moved. <a href="${redirectTo}">Click here if not redirected automatically.</a>`;
    const page: Page = {
      title: `Redirect to ${redirectTo}`,
      url: redirectFrom,
      collection: 'redirects',
      outputPath: path.join(
        options.outputDirectory,
        redirectFrom,
        'index.html'
      ),
      content
    };

    redirectPages.push(page);
  }

  return redirectPages;
}
