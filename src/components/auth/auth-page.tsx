import Link from "next/link";
import { type ReactNode } from "react";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="auth-frame">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Taskfella home">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Taskfella</span>
        </Link>
        <nav aria-label="Account navigation">
          <Link className="nav-link" href="/login">
            Sign in
          </Link>
          <Link className="nav-link" href="/signup">
            Create account
          </Link>
        </nav>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <span>Taskfella</span>
        <span>Private, focused personal work.</span>
      </footer>
    </div>
  );
}
