import Link from "next/link";

export default function NotFound() {
  return (
    <main className="boundary-screen" role="status">
      <p className="eyebrow">404</p>
      <h1>That page is not here yet.</h1>
      <p>Return to the Taskfella foundation to continue.</p>
      <Link className="primary-action" href="/">
        Back to Taskfella
      </Link>
    </main>
  );
}
