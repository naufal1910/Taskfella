"use client";

import { Button } from "@/components/ui/primitives";

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
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
