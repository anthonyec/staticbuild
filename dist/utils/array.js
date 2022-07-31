"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unique = void 0;
function unique(array) {
    return array.filter((value, index, self) => {
        return self.indexOf(value) === index;
    });
}
exports.unique = unique;
//# sourceMappingURL=array.js.map