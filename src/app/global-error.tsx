"use client";

import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="boundary-screen" role="alert">
          <p className="eyebrow">Taskfella</p>
          <h1>The application needs a fresh start.</h1>
          <p>Refresh the foundation and try again.</p>
          <button className="primary-action button-action" type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
