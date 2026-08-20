import Link from "next/link";

import { BrandMark, Button, StatusBadge, Surface } from "@/components/ui/primitives";

const foundationChecks = [
  {
    label: "Email and password identity",
    value: "Ready",
    detail: "Signup, verification, login, logout, and password recovery are available.",
  },
  {
    label: "Secure account foundation",
    value: "Protected",
    detail: "Opaque sessions, CSRF checks, hashed tokens, and database rate limits are active.",
  },
  {
    label: "Focused workspaces",
    value: "Coming next",
    detail: "Board and execution workflows will build on the authenticated account.",
  },
];

export function TaskfellaShell() {
  return (
    <div className="site-frame">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Taskfella home">
          <BrandMark />
          <span>Taskfella</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <a className="nav-link active" href="#foundation" aria-current="page">
            Foundation
          </a>
          <a className="nav-link" href="#status">
            Status
          </a>
          <Link className="nav-link" href="/login">
            Sign in
          </Link>
          <Link className="nav-link" href="/signup">
            Create account
          </Link>
        </nav>
        <span className="phase-badge">Phase 1B</span>
      </header>

      <main id="foundation" className="shell-main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Personal execution, thoughtfully prepared</p>
          <h1 id="hero-title">A calmer place to move meaningful work forward.</h1>
          <p className="hero-copy">
            Taskfella is building a focused, board-first workspace for personal projects. Create an
            account to keep your work ready for the product layers ahead.
          </p>
          <div className="hero-actions">
            <Button href="/signup" variant="primary">
              Create your account <span aria-hidden="true">→</span>
            </Button>
            <Button href="#status" variant="secondary">
              Explore the foundation <span aria-hidden="true">↓</span>
            </Button>
          </div>
        </section>

        <Surface
          as="section"
          id="status"
          className="status-card"
          elevated
          aria-labelledby="status-title"
        >
          <div className="status-heading">
            <div>
              <p className="eyebrow">System foundation</p>
              <h2 id="status-title">A dependable beginning.</h2>
            </div>
            <StatusBadge status="success">Ready</StatusBadge>
          </div>
          <div className="check-list">
            {foundationChecks.map((check) => (
              <article className="check-row" key={check.label}>
                <span className="check-icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <h3>{check.label}</h3>
                  <p>{check.detail}</p>
                </div>
                <strong>{check.value}</strong>
              </article>
            ))}
          </div>
        </Surface>
      </main>

      <footer className="site-footer">
        <span>Taskfella</span>
        <span>Built for focused personal work.</span>
      </footer>
    </div>
  );
}
