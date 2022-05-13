export function getCollectionsFromPages(pages: Page[]): Collections {
  const collections: Collections = {};

  for (const page of pages) {
    if (page.collection) {
      if (!collections[page.collection]) {
        collections[page.collection] = [];
      }

      collections[page.collection].push(page);
    }
  }

  return collections;
}
