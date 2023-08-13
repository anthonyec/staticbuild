import * as mustache from 'mustache';

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

async function getObjectWithFunctionsInvoked<T, A>(
  object: T,
  invokedFunctionArgument: A
): Promise<T> {
  const clonedObject: T = { ...object };

  for (const key in clonedObject) {
    const value = clonedObject[key];

    if (typeof value === 'function') {
      clonedObject[key] = await value(invokedFunctionArgument);
    }
  }

  return clonedObject;
}

async function withComputedValues<T>(
  namespacesToCompute: string[],
  originalStructure: T
): Promise<T> {
  const clonedOriginalStructure: T = { ...originalStructure };

  for (const namespace of namespacesToCompute) {
    // As keyof T solution found here:
    // https://stackoverflow.com/questions/55012174/why-doesnt-object-keys-return-a-keyof-type-in-typescript/55012175#55012175
    const namespaceObject = clonedOriginalStructure[namespace as keyof T];

    clonedOriginalStructure[namespace as keyof T] =
      await getObjectWithFunctionsInvoked(namespaceObject, originalStructure);
  }

  return clonedOriginalStructure;
}

export async function renderPages(options: RenderPageOptions) {
  const renderedPages = [];

  for await (const page of options.pages) {
    // Computed values is asynchronous because values can come from the network.
    const context: RenderContext = await withComputedValues<RenderContext>(
      ['data'],
      {
        env: options.env,
        functions: options.functions,
        collections: options.collections,
        data: options.data,
        page
      }
    );
    const template =
      (page.layout && options.layouts[page.layout]) || page.content;

    const renderedPage = mustache.render(
      options.hooks.onRenderPage(context, template),
      context,
      options.partials
    );

    renderedPages.push({
      ...page,
      content: renderedPage
    });
  }

  return renderedPages;
}
