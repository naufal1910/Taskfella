import { BrandMark } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <main className="loading-screen" aria-busy="true" aria-live="polite">
      <BrandMark className="loading-mark" />
      <p>Preparing your workspace…</p>
    </main>
  );
}
