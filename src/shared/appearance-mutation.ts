export interface AppearanceMutationTracker<T> {
  advance(): number;
  current(): number;
  isCurrent(revision: number): boolean;
  recordSaved(value: T): void;
  getSaved(): T | undefined;
}

export function createAppearanceMutationTracker<T>(): AppearanceMutationTracker<T> {
  let currentRevision = 0;
  let savedValue: T | undefined;
  return {
    advance(): number {
      currentRevision += 1;
      return currentRevision;
    },
    current(): number {
      return currentRevision;
    },
    isCurrent(revision: number): boolean {
      return revision === currentRevision;
    },
    recordSaved(value: T): void {
      savedValue = value;
    },
    getSaved(): T | undefined {
      return savedValue;
    },
  };
}
