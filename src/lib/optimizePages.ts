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
  doctype: DOMNode | null;
}

function hash(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

function optimizeCSS(document: Document): Asset | null {
  const links = Array.from(document.querySelectorAll('link'));
  const stylesheets = links.filter((link) => {
    return link.getAttribute('rel') === 'stylesheet';
  });

  if (stylesheets.length === 0) {
    return null;
  }

  const hrefs = stylesheets.map((stylesheet) => {
    return stylesheet.getAttribute('href');
  });
  const filename = `${hash(hrefs.join())}.css`;
  // TODO: Remove reliance on first path
  const outputPath = path.join(path.dirname(hrefs[0]), filename);

  stylesheets.forEach((stylesheet) => {
    stylesheet.remove();
  });

  const css = document.createElement('link');

  css.setAttribute('href', outputPath);
  css.setAttribute('rel', 'stylesheet');

  document.querySelector('head').appendChild(css);

  return {
    filename,
    inputPath: hrefs,
    outputPath
  };
}

function optimizeJS(document: Document): Asset | null {
  const scripts = Array.from(document.querySelectorAll('script'));

  if (scripts.length === 0) {
    return null;
  }

  const concatenatedScript = scripts.reduce((mem, script) => {
    return mem + `${script.innerHTML}\n`;
  }, '');

  const filename = `${hash(concatenatedScript)}.js`;
  // TODO: Remove hard-coded path
  const outputPath = path.join('/assets/js', filename);

  const js = document.createElement('script');

  js.setAttribute('src', outputPath);
  js.setAttribute('defer', '');

  document.querySelector('head').appendChild(js);

  scripts.forEach((script) => {
    script.remove();
  });

  return {
    filename,
    inputPath: `data: ${concatenatedScript}`,
    outputPath
  };
}

export function optimizePages(pages: Page[]): [Page[], Asset[]] {
  const optimizedPages: Page[] = [];
  const extractedAssets: Asset[] = [];

  // TODO: Should non-html pages be filtered out?
  for (const page of pages) {
    const extension = path.extname(page.outputPath);

    if (extension === '.html') {
      const document = createDocument(page.content) as Document;
      const extractedAssetFromCSS = optimizeCSS(document);
      const extractedAssetFromJS = optimizeJS(document);

      if (extractedAssetFromCSS) {
        extractedAssets.push(extractedAssetFromCSS);
      }

      if (extractedAssetFromJS) {
        extractedAssets.push(extractedAssetFromJS);
      }

      optimizedPages.push({
        ...page,

        // TODO: Fix missing doctype on posts!
        content: document.outerHTML
      });
    } else {
      optimizedPages.push(page);
    }
  }

  return [optimizedPages, extractedAssets];
}
