"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizePages = void 0;
const hyntax_1 = require("hyntax");
function stringifyAST(ast) {
    // console.log(ast);
    let builtString = '';
    for (const child of ast.content.children) {
        console.log(child);
    }
    return builtString;
}
function optimizePages(pages) {
    const { tokens } = (0, hyntax_1.tokenize)(pages[0].content);
    const { ast } = (0, hyntax_1.constructTree)(tokens);
    // console.log(ast)
    stringifyAST(ast);
    // console.log(ast.content.children);
    for (const page of pages) {
    }
    // console.log(pages[0].content);
    return [[], []];
}
exports.optimizePages = optimizePages;
//# sourceMappingURL=optimisePages.js.map