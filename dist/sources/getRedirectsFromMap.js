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
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
function getRedirectsFromMap(options) {
    const redirectPages = [];
    for (const redirectFrom in options.redirects) {
        const redirectTo = options.redirects[redirectFrom];
        const content = `<link href="${redirectTo}" rel="canonical"><meta http-equiv="refresh" content="0;url=${redirectTo}" />This page has moved. <a href="${redirectTo}">Click here if not redirected automatically.</a>`;
        const page = {
            title: `Redirect to ${redirectTo}`,
            url: redirectFrom,
            collection: 'redirects',
            outputPath: path.join(options.outputDirectory, redirectFrom, 'index.html'),
            content
        };
        redirectPages.push(page);
    }
    return redirectPages;
}
exports.default = getRedirectsFromMap;
//# sourceMappingURL=getRedirectsFromMap.js.map