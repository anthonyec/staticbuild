"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssetsFromPages = void 0;
function getAssetsFromPages(pages) {
    const assets = [];
    for (const page of pages) {
        if (page.assets) {
            assets.push(...page.assets);
        }
    }
    return assets;
}
exports.getAssetsFromPages = getAssetsFromPages;
//# sourceMappingURL=getAssetsFromPages.js.map