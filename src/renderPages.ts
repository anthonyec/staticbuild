import * as fs from 'fs/promises';
import * as path from 'path';
import * as mustache from 'mustache';

interface RenderPageOptions {
  pages: Page[];
  layouts: {
    [name: string]: string;
  };
  partials: {
    [name: string]: string;
  };
  functions: RenderContext['functions'];
  collections: RenderContext['collections'];
  data: RenderContext['data'];
}

function getObjectWithFunctionsInvoked<T, A>(
  object: T,
  invokedFunctionArgument: A
): T {
  const clonedObject: T = { ...object };

  for (const key in clonedObject) {
    const value = clonedObject[key];

    if (typeof value === 'function') {
      clonedObject[key] = value(invokedFunctionArgument);
    }
  }

  return clonedObject;
}

function withComputedValues<T>(
  namespacesToCompute: string[],
  originalStructure: T
): T {
  const clonedOriginalStructure: T = { ...originalStructure };

  for (const namespace of namespacesToCompute) {
    // As keyof T solution found here:
    // https://stackoverflow.com/questions/55012174/why-doesnt-object-keys-return-a-keyof-type-in-typescript/55012175#55012175
    const namespaceObject = clonedOriginalStructure[namespace as keyof T];

    clonedOriginalStructure[namespace as keyof T] =
      getObjectWithFunctionsInvoked(namespaceObject, originalStructure);
  }

  return clonedOriginalStructure;
}

export async function renderPages(options: RenderPageOptions) {
  for await (const page of options.pages) {
    const outputDirectory = path.dirname(page.outputPath);
    const context: RenderContext = withComputedValues<RenderContext>(['data'], {
      env: {
        devMode: process.env.NODE_ENV === 'dev'
      },
      functions: options.functions,
      collections: options.collections,
      data: options.data,
      page
    });
    const template =
      (page.layout && options.layouts[page.layout]) || page.content;

    // TODO: Handle errors from bad templates!
    const renderedPage = mustache.render(template, context, options.partials);

    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(page.outputPath, renderedPage, 'utf8');
  }
}
