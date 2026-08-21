export interface EnqueuedOperation<T> {
  result: Promise<T>;
  tail: Promise<void>;
}

export function enqueue<T>(tail: Promise<void>, operation: () => Promise<T>): EnqueuedOperation<T> {
  const result = tail.then(operation, operation);
  return {
    result,
    tail: result.then(
      () => undefined,
      () => undefined,
    ),
  };
}
