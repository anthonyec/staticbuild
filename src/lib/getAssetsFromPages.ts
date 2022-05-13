export function getAssetsFromPages(pages: Page[]): Asset[] {
  const assets: Asset[] = [];

  for (const page of pages) {
    if (page.assets) {
      assets.push(...page.assets);
    }
  }

  return assets;
}
