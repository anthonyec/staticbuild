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
export declare function renderPages(options: RenderPageOptions): Promise<{
    content: string;
    title: string;
    url: string;
    slug?: string | undefined;
    date?: Date | undefined;
    collection?: string | undefined;
    layout?: string | undefined;
    outputPath: string;
    assets?: Asset[] | undefined;
}[]>;
export {};
