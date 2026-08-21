import Link from "next/link";
import { BrandMark } from "@/components/ui/primitives";
import { SettingsPanel } from "./settings-panel";

export function SettingsScreen() {
  return (
    <div className="settings-frame">
      <header className="settings-header">
        <Link className="brand" href="/">
          <BrandMark />
          <span>Taskfella</span>
        </Link>
        <nav className="settings-nav" aria-label="Workspace navigation">
          <Link className="nav-link" href="/">
            Home
          </Link>
          <Link className="nav-link active" href="/settings" aria-current="page">
            Settings
          </Link>
          <Link className="nav-link" href="/logout">
            Sign out
          </Link>
        </nav>
      </header>

      <main className="settings-main">
        <div className="settings-intro">
          <p className="eyebrow">Personal workspace</p>
          <h1>Account settings</h1>
          <p>
            Shape the way Taskfella meets you: your profile, local day, appearance, gentle
            notifications, and focus rhythm.
          </p>
        </div>
        <SettingsPanel />
      </main>

      <footer className="settings-footer">
        <span>Taskfella</span>
        <span>Private, focused personal work.</span>
      </footer>
    </div>
  );
}
