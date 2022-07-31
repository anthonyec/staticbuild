"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBuiltInPartials = void 0;
function getBuiltInPartials() {
    return {
        __staticbuild_badge: `
      <div class="__staticbuild_badge" style="text-align: center; padding: 15px 0 25px;">
        <span class="__staticbuild_badge__inner" style="background-color: rgba(255, 255, 255, 1); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1); padding: 5px 12px; border-radius: 100px; display: inline-block;">
          Built with <a href="https://github.com/anthonyec/staticbuild" target="_blank" style="color: inherit; font-weight: bold;">staticbuild</a>
        </span>
      </div>
    `,
        __staticbuild_comment: `<!-- Built with staticbuild: https://github.com/anthonyec/staticbuild -->`
    };
}
exports.getBuiltInPartials = getBuiltInPartials;
//# sourceMappingURL=getBuiltInPartials.js.map