"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEndOfFileToken = exports.createCharacterToken = exports.createCommentToken = exports.createTagToken = exports.createDocTypeToken = void 0;
var HTMLTokenType;
(function (HTMLTokenType) {
    HTMLTokenType[HTMLTokenType["DocType"] = 0] = "DocType";
    HTMLTokenType[HTMLTokenType["StartTag"] = 1] = "StartTag";
    HTMLTokenType[HTMLTokenType["EndTag"] = 2] = "EndTag";
    HTMLTokenType[HTMLTokenType["Comment"] = 3] = "Comment";
    HTMLTokenType[HTMLTokenType["Character"] = 4] = "Character";
    HTMLTokenType[HTMLTokenType["EndOfFile"] = 5] = "EndOfFile";
})(HTMLTokenType || (HTMLTokenType = {}));
function createDocTypeToken(properties) {
    return {
        type: HTMLTokenType.DocType,
        forceQuirks: false,
        ...properties
    };
}
exports.createDocTypeToken = createDocTypeToken;
function createTagToken(type, properties) {
    return {
        type: type === 'end' ? HTMLTokenType.EndTag | HTMLTokenType.StartTag : ,
        selfClosing: false,
        attributes: {},
        ...properties
    };
}
exports.createTagToken = createTagToken;
function createCommentToken(data) {
    return {
        type: HTMLTokenType.Comment,
        data
    };
}
exports.createCommentToken = createCommentToken;
function createCharacterToken(data) {
    return {
        type: HTMLTokenType.Character,
        data
    };
}
exports.createCharacterToken = createCharacterToken;
function createEndOfFileToken() {
    return {
        type: HTMLTokenType.EndOfFile
    };
}
exports.createEndOfFileToken = createEndOfFileToken;
//# sourceMappingURL=tokens.js.map