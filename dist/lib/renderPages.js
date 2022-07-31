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
exports.renderPages = void 0;
const mustache = __importStar(require("mustache"));
async function getObjectWithFunctionsInvoked(object, invokedFunctionArgument) {
    const clonedObject = { ...object };
    for (const key in clonedObject) {
        const value = clonedObject[key];
        if (typeof value === 'function') {
            clonedObject[key] = await value(invokedFunctionArgument);
        }
    }
    return clonedObject;
}
async function withComputedValues(namespacesToCompute, originalStructure) {
    const clonedOriginalStructure = { ...originalStructure };
    for (const namespace of namespacesToCompute) {
        // As keyof T solution found here:
        // https://stackoverflow.com/questions/55012174/why-doesnt-object-keys-return-a-keyof-type-in-typescript/55012175#55012175
        const namespaceObject = clonedOriginalStructure[namespace];
        clonedOriginalStructure[namespace] =
            await getObjectWithFunctionsInvoked(namespaceObject, originalStructure);
    }
    return clonedOriginalStructure;
}
async function renderPages(options) {
    const renderedPages = [];
    for await (const page of options.pages) {
        const context = await withComputedValues(['data'], {
            env: options.env,
            functions: options.functions,
            collections: options.collections,
            data: options.data,
            page
        });
        const template = (page.layout && options.layouts[page.layout]) || page.content;
        const renderedPage = mustache.render(options.hooks.onRenderPage(context, template), context, options.partials);
        renderedPages.push({
            ...page,
            content: renderedPage
        });
    }
    return renderedPages;
}
exports.renderPages = renderPages;
//# sourceMappingURL=renderPages.js.map