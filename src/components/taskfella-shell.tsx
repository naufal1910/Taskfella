import Link from "next/link";

const foundationChecks = [
  {
    label: "Responsive application shell",
    value: "Ready",
    detail: "A calm starting point on every screen size.",
  },
  {
    label: "PostgreSQL foundation",
    value: "Connected by configuration",
    detail: "Database readiness is exposed through the health API.",
  },
  {
    label: "Product workflows",
    value: "Coming in later phases",
    detail: "Phase 0 keeps the foundation deliberately small.",
  },
];

export function TaskfellaShell() {
  return (
    <div className="site-frame">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Taskfella home">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Taskfella</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <a className="nav-link active" href="#foundation" aria-current="page">
            Foundation
          </a>
          <a className="nav-link" href="#status">
            Status
          </a>
        </nav>
        <span className="phase-badge">Phase 0</span>
      </header>

      <main id="foundation" className="shell-main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Personal execution, thoughtfully prepared</p>
          <h1 id="hero-title">A calmer place to move meaningful work forward.</h1>
          <p className="hero-copy">
            Taskfella is building a focused, board-first workspace for personal projects. The
            application foundation is ready for the product layers ahead.
          </p>
          <a className="primary-action" href="#status">
            Explore the foundation <span aria-hidden="true">↓</span>
          </a>
        </section>

        <section id="status" className="status-card" aria-labelledby="status-title">
          <div className="status-heading">
            <div>
              <p className="eyebrow">System foundation</p>
              <h2 id="status-title">A dependable beginning.</h2>
            </div>
            <span className="status-indicator">
              <span className="status-dot" aria-hidden="true" />
              Ready
            </span>
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
        </section>
      </main>

      <footer className="site-footer">
        <span>Taskfella</span>
        <span>Built for focused personal work.</span>
      </footer>
    </div>
  );
}
