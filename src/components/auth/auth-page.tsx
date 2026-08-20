import Link from "next/link";
import { type ReactNode } from "react";
import { BrandMark } from "@/components/ui/primitives";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="auth-frame">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Taskfella home">
          <BrandMark />
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
      <main className="auth-main">
        <div className="auth-content">
          <div className="auth-identity" aria-hidden="true">
            <BrandMark className="auth-identity__mark" />
            <span>Private, focused personal work</span>
          </div>
          {children}
        </div>
      </main>
      <footer className="auth-footer">
        <span>Taskfella</span>
        <span>Private, focused personal work.</span>
      </footer>
    </div>
  );
}
