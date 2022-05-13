import * as fs from 'fs/promises';
import * as path from 'path';

// TODO: Better types for callback? What do other debounces do online for types?
function debounce(callback: () => void, timeout: number = 300) {
  let timer: NodeJS.Timeout;

  return () => {
    clearTimeout(timer);
    timer = setTimeout(callback, timeout);
  };
}

export async function watchDirectoryForChanges(
  targetDirectoryPath: string,
  onChange: (changedFilePaths: string[]) => void
) {
  let collatedChangeEvents: fs.FileChangeInfo<string>[] = [];

  const watcher = fs.watch(targetDirectoryPath, {
    recursive: true
  });
  const onChangeDebounced = debounce(() => {
    const changedFilePaths = collatedChangeEvents.map((changeEvent) => {
      return path.join(targetDirectoryPath, changeEvent.filename);
    });

    onChange(changedFilePaths);
    collatedChangeEvents = [];
  });

  try {
    // Using debounce because `fs.watch` likes to emit events
    // twice for the same file in quick succession. It's known to be buggy.
    for await (const event of watcher) {
      const hasExistingEvent = collatedChangeEvents.find((changeEvent) => {
        return changeEvent.filename === event.filename;
      });

      if (!hasExistingEvent) {
        collatedChangeEvents.push(event);
      }

      onChangeDebounced();
    }
  } catch (err) {
    console.error('File watcher error', err);
  }
}
