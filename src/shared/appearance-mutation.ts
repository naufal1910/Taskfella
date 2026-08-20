export interface AppearanceMutationTracker<T> {
  advance(): number;
  current(): number;
  isCurrent(revision: number): boolean;
  recordSaved(value: T, revision?: number): void;
  getSaved(): T | undefined;
  hasUnsaved(): boolean;
}

export function createAppearanceMutationTracker<T>(): AppearanceMutationTracker<T> {
  let currentRevision = 0;
  let savedValue: T | undefined;
  let unsaved = false;
  return {
    advance(): number {
      currentRevision += 1;
      unsaved = true;
      return currentRevision;
    },
    current(): number {
      return currentRevision;
    },
    isCurrent(revision: number): boolean {
      return revision === currentRevision;
    },
    recordSaved(value: T, revision?: number): void {
      savedValue = value;
      if (revision === undefined || revision === currentRevision) unsaved = false;
    },
    getSaved(): T | undefined {
      return savedValue;
    },
    hasUnsaved(): boolean {
      return unsaved;
    },
  };
}
