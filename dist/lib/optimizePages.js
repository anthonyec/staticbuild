"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizePages = void 0;
const crypto = __importStar(require("crypto"));
const domino_1 = require("domino");
const path_1 = __importDefault(require("path"));
function hash(value) {
    return crypto.createHash('md5').update(value).digest('hex');
}
function optimizeCSS(document) {
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
    const outputPath = path_1.default.join(path_1.default.dirname(hrefs[0]), filename);
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
function optimizeJS(document) {
    const scripts = Array.from(document.querySelectorAll('script'));
    if (scripts.length === 0) {
        return null;
    }
    const concatenatedScript = scripts.reduce((mem, script) => {
        return mem + `${script.innerHTML}\n`;
    }, '');
    const filename = `${hash(concatenatedScript)}.js`;
    // TODO: Remove hard-coded path
    const outputPath = path_1.default.join('/assets/js', filename);
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
function optimizePages(pages) {
    const optimizedPages = [];
    const extractedAssets = [];
    // TODO: Should non-html pages be filtered out?
    for (const page of pages) {
        const extension = path_1.default.extname(page.outputPath);
        if (extension === '.html') {
            const document = (0, domino_1.createDocument)(page.content);
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
        }
        else {
            optimizedPages.push(page);
        }
    }
    return [optimizedPages, extractedAssets];
}
exports.optimizePages = optimizePages;
//# sourceMappingURL=optimizePages.js.map