"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionsFromPages = void 0;
function getCollectionsFromPages(pages) {
    const collections = {};
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
exports.getCollectionsFromPages = getCollectionsFromPages;
//# sourceMappingURL=pages.js.map