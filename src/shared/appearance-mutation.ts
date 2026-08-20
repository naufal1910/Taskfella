export interface AppearanceMutationTracker {
  advance(): number;
  isCurrent(revision: number): boolean;
}

export function createAppearanceMutationTracker(): AppearanceMutationTracker {
  let currentRevision = 0;
  return {
    advance(): number {
      currentRevision += 1;
      return currentRevision;
    },
    isCurrent(revision: number): boolean {
      return revision === currentRevision;
    },
  };
}
