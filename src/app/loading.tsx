export default function Loading() {
  return (
    <main className="loading-screen" aria-busy="true" aria-live="polite">
      <div className="loading-mark" aria-hidden="true">
        T
      </div>
      <p>Preparing your workspace…</p>
    </main>
  );
}
