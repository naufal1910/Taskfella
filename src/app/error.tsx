"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="boundary-screen" role="alert">
      <p className="eyebrow">Something went off course</p>
      <h1>We could not load this view.</h1>
      <p>Try again. If the problem continues, the health endpoint can help diagnose the service.</p>
      <button className="primary-action button-action" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
