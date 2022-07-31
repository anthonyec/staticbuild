"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forEachRegexMatch = exports.removeRangeFromString = void 0;
function removeRangeFromString(target, start, end) {
    return target.substring(0, start) + target.substring(target.length, end);
}
exports.removeRangeFromString = removeRangeFromString;
function forEachRegexMatch(target, regex, callback) {
    let match;
    while ((match = regex.exec(target)) !== null) {
        callback(match);
    }
}
exports.forEachRegexMatch = forEachRegexMatch;
//# sourceMappingURL=string.js.map