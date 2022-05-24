import * as crypto from 'crypto';
import { createDocument } from 'domino';
import path from 'path';

// TODO: Has anyone made these types before so that I can just install them?
interface DOMNode {
  innerHTML: string;
  outerHTML: string;
  querySelector: (selector: string) => DOMNode;
  querySelectorAll: (selector: string) => DOMNode[];
  remove: () => void;
  getAttribute: (name: string) => string;
  setAttribute: (name: string, value: string) => void;
  appendChild: (child: DOMNode) => void;
}

interface Document extends DOMNode {
  createElement: (tagName: string) => DOMNode;
}

export function optimizePages(pages: Page[]): [Page[], Asset[]] {
  const optimizedPages: Page[] = [];
  const extractedAssets: Asset[] = [];

  // TODO: Should non-html pages be filtered out?
  for (const page of pages) {
    const document = createDocument(page.content) as Document;
    const links = Array.from(document.querySelectorAll('link'));
    const stylesheets = links.filter((link) => {
      return link.getAttribute('rel') === 'stylesheet';
    });

    if (stylesheets.length === 0) {
      continue;
    }

    const hrefs = stylesheets.map((stylesheet) => {
      return stylesheet.getAttribute('href');
    });
    const hash = crypto.createHash('md5').update(hrefs.join()).digest('hex');
    const filename = `${hash}.css`;
    const outputPath = path.join(path.dirname(hrefs[0]), filename);

    stylesheets.forEach((stylesheet) => {
      stylesheet.remove();
    });

    const css = document.createElement('link');

    css.setAttribute('href', outputPath);
    css.setAttribute('rel', 'stylesheet');

    document.querySelector('head').appendChild(css);

    extractedAssets.push({
      filename,
      inputPath: hrefs,
      outputPath
    });

    optimizedPages.push({
      ...page,
      content: document.outerHTML
    });
  }

  return [optimizedPages, extractedAssets];
}
