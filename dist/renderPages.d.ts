interface RenderPageOptions {
    pages: Page[];
    layouts: {
        [name: string]: string;
    };
    partials: {
        [name: string]: string;
    };
    hooks: Hooks;
    env: RenderContext['env'];
    functions: RenderContext['functions'];
    collections: RenderContext['collections'];
    data: RenderContext['data'];
}
export declare function renderPages(options: RenderPageOptions): Promise<void>;
export {};
